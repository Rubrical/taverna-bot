import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

type WriteCallback = (error?: Error | null) => void;
type WritableWrite = (
  chunk: string | Uint8Array,
  encoding?: BufferEncoding | WriteCallback,
  callback?: WriteCallback,
) => boolean;

type WritableTarget = { write: WritableWrite };

type FileSystemAdapter = {
  appendFile: typeof appendFile;
  mkdir: typeof mkdir;
};

export interface FileConsoleTransportOptions {
  readonly cwd?: string;
  readonly directory?: string;
  readonly fileSystem?: FileSystemAdapter;
  readonly now?: () => Date;
  readonly stderr?: WritableTarget;
  readonly stdout?: WritableTarget;
}

const ANSI_ESCAPE_PATTERN = new RegExp(String.raw`\u001b\[[0-9;]*m`, 'g');

export class FileConsoleTransport {
  private readonly cwd: string;
  private readonly directory: string;
  private readonly fileSystem: FileSystemAdapter;
  private readonly now: () => Date;
  private readonly stderr: WritableTarget;
  private readonly stdout: WritableTarget;
  private readonly originalStderrWrite: WritableWrite;
  private readonly originalStdoutWrite: WritableWrite;
  private currentDateKey?: string;
  private currentFilePath?: string;
  private isStarted = false;
  private pendingWrite: Promise<void> = Promise.resolve();

  constructor(options: FileConsoleTransportOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.directory = options.directory ?? 'logs';
    this.fileSystem = options.fileSystem ?? {
      appendFile,
      mkdir,
    };
    this.now = options.now ?? (() => new Date());
    this.stdout = options.stdout ?? process.stdout;
    this.stderr = options.stderr ?? process.stderr;
    this.originalStdoutWrite = this.stdout.write;
    this.originalStderrWrite = this.stderr.write;
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    const directoryPath = this.resolveDirectoryPath();

    try {
      await this.fileSystem.mkdir(directoryPath, { recursive: true });
    } catch (error: unknown) {
      this.reportFailure(error);
      return;
    }

    this.stdout.write = this.createIntercept(this.stdout, this.originalStdoutWrite);
    this.stderr.write = this.createIntercept(this.stderr, this.originalStderrWrite);
    this.isStarted = true;
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.stdout.write = this.originalStdoutWrite;
    this.stderr.write = this.originalStderrWrite;
    this.isStarted = false;

    await this.pendingWrite.catch(() => undefined);
  }

  private createIntercept(target: WritableTarget, originalWrite: WritableWrite): WritableWrite {
    const boundOriginalWrite = originalWrite.bind(target) as WritableWrite;

    return (chunk, encoding, callback) => {
      const result = boundOriginalWrite(chunk, encoding, callback);
      this.enqueueWrite(chunk);
      return result;
    };
  }

  private enqueueWrite(chunk: string | Uint8Array): void {
    const message = this.sanitizeChunk(chunk);

    if (!message) {
      return;
    }

    const filePath = this.resolveCurrentFilePath();

    const writeTask = this.pendingWrite.then(async () => {
      await this.fileSystem.appendFile(filePath, message, 'utf8');
    });

    this.pendingWrite = writeTask.catch((error: unknown) => {
      this.reportFailure(error);
    });
  }

  private resolveCurrentFilePath(): string {
    const dateKey = this.formatDateKey(this.now());

    if (this.currentDateKey === dateKey && this.currentFilePath) {
      return this.currentFilePath;
    }

    this.currentDateKey = dateKey;
    this.currentFilePath = path.resolve(this.resolveDirectoryPath(), `app-${dateKey}.log`);

    return this.currentFilePath;
  }

  private resolveDirectoryPath(): string {
    return path.resolve(this.cwd, this.directory);
  }

  private sanitizeChunk(chunk: string | Uint8Array): string {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return text.replace(ANSI_ESCAPE_PATTERN, '');
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private reportFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const boundOriginalStderrWrite = this.originalStderrWrite.bind(this.stderr) as WritableWrite;

    boundOriginalStderrWrite(`[FileConsoleTransport] Failed to write log to file: ${message}\n`, 'utf8');
  }
}
