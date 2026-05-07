import path from 'node:path';
import type { mkdir } from 'node:fs/promises';

import {
  FileConsoleTransport,
  type FileConsoleTransportOptions,
} from '../../../src/logger/infrastructure/file-console.transport.js';

type WriteCallback = (error?: Error | null) => void;

type WritableWrite = (
  chunk: string | Uint8Array,
  encoding?: BufferEncoding | WriteCallback,
  callback?: WriteCallback,
) => boolean;

type WritableTargetMock = {
  write: jest.Mock<boolean, Parameters<WritableWrite>>;
};

type FileSystemMock = {
  appendFile: jest.Mock<Promise<void>, [string, string, BufferEncoding]>;
  mkdir: jest.Mock<Promise<string | undefined>, [Parameters<typeof mkdir>[0], Parameters<typeof mkdir>[1]?]>;
};

function createWritableTarget(): WritableTargetMock {
  return {
    write: jest.fn<boolean, Parameters<WritableWrite>>().mockReturnValue(true),
  };
}

function createFileSystemMock(): FileSystemMock {
  return {
    appendFile: jest.fn<Promise<void>, [string, string, BufferEncoding]>().mockResolvedValue(undefined),
    mkdir: jest
      .fn<Promise<string | undefined>, [Parameters<typeof mkdir>[0], Parameters<typeof mkdir>[1]?]>()
      .mockResolvedValue(undefined),
  };
}

function asFileSystemAdapter(fileSystem: FileSystemMock): NonNullable<FileConsoleTransportOptions['fileSystem']> {
  return fileSystem as unknown as NonNullable<FileConsoleTransportOptions['fileSystem']>;
}

describe('FileConsoleTransport', () => {
  let fileSystem: FileSystemMock;
  let stdout: WritableTargetMock;
  let stderr: WritableTargetMock;

  beforeEach(() => {
    fileSystem = createFileSystemMock();
    stdout = createWritableTarget();
    stderr = createWritableTarget();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should mirror stdout output to the daily log file', async () => {
    const transport = new FileConsoleTransport({
      cwd: '/home/lipian/projetos/taverna-bot',
      directory: 'logs',
      fileSystem: asFileSystemAdapter(fileSystem),
      now: () => new Date('2026-05-06T14:24:19.000Z'),
      stderr,
      stdout,
    });

    await transport.start();

    stdout.write('[Taverna Bot] Starting Nest application...\n', 'utf8');
    await transport.stop();

    expect(fileSystem.mkdir).toHaveBeenCalledWith(path.resolve('/home/lipian/projetos/taverna-bot', 'logs'), {
      recursive: true,
    });
    expect(fileSystem.appendFile).toHaveBeenCalledWith(
      path.resolve('/home/lipian/projetos/taverna-bot', 'logs', 'app-2026-05-06.log'),
      '[Taverna Bot] Starting Nest application...\n',
      'utf8',
    );
  });

  it('should mirror stderr output to the daily log file', async () => {
    const transport = new FileConsoleTransport({
      cwd: '/workspace',
      directory: 'logs',
      fileSystem: asFileSystemAdapter(fileSystem),
      now: () => new Date('2026-05-06T14:24:19.000Z'),
      stderr,
      stdout,
    });

    await transport.start();

    stderr.write('[Taverna Bot] Failed to bootstrap\n', 'utf8');
    await transport.stop();

    expect(fileSystem.appendFile).toHaveBeenCalledWith(
      path.resolve('/workspace', 'logs', 'app-2026-05-06.log'),
      '[Taverna Bot] Failed to bootstrap\n',
      'utf8',
    );
  });

  it('should strip ANSI escape codes before writing the file', async () => {
    const transport = new FileConsoleTransport({
      cwd: '/workspace',
      fileSystem: asFileSystemAdapter(fileSystem),
      now: () => new Date('2026-05-06T14:24:19.000Z'),
      stderr,
      stdout,
    });

    await transport.start();

    stdout.write('\u001b[32m[Taverna Bot]\u001b[39m Ready\n', 'utf8');
    await transport.stop();

    expect(fileSystem.appendFile).toHaveBeenCalledWith(
      path.resolve('/workspace', 'logs', 'app-2026-05-06.log'),
      '[Taverna Bot] Ready\n',
      'utf8',
    );
  });

  it('should rotate the file when the day changes', async () => {
    const currentDate = { value: '2026-05-06T23:59:59.000Z' };
    const transport = new FileConsoleTransport({
      cwd: '/workspace',
      fileSystem: asFileSystemAdapter(fileSystem),
      now: () => new Date(currentDate.value),
      stderr,
      stdout,
    });

    await transport.start();

    stdout.write('first log\n', 'utf8');
    currentDate.value = '2026-05-07T00:00:01.000Z';
    stdout.write('second log\n', 'utf8');
    await transport.stop();

    expect(fileSystem.appendFile).toHaveBeenNthCalledWith(
      1,
      path.resolve('/workspace', 'logs', 'app-2026-05-06.log'),
      'first log\n',
      'utf8',
    );
    expect(fileSystem.appendFile).toHaveBeenNthCalledWith(
      2,
      path.resolve('/workspace', 'logs', 'app-2026-05-07.log'),
      'second log\n',
      'utf8',
    );
  });

  it('should restore the original writers when stopped', async () => {
    const originalStdoutWrite = stdout.write;
    const originalStderrWrite = stderr.write;
    const transport = new FileConsoleTransport({
      cwd: '/workspace',
      fileSystem: asFileSystemAdapter(fileSystem),
      now: () => new Date('2026-05-06T14:24:19.000Z'),
      stderr,
      stdout,
    });

    await transport.start();
    await transport.stop();

    expect(stdout.write).toBe(originalStdoutWrite);
    expect(stderr.write).toBe(originalStderrWrite);
  });

  it('should report append failures without throwing', async () => {
    fileSystem.appendFile.mockRejectedValueOnce(new Error('disk unavailable'));
    const originalStderrWrite = stderr.write;
    const transport = new FileConsoleTransport({
      cwd: '/workspace',
      fileSystem: asFileSystemAdapter(fileSystem),
      now: () => new Date('2026-05-06T14:24:19.000Z'),
      stderr,
      stdout,
    });

    await transport.start();

    expect(() => stdout.write('unflushed log\n', 'utf8')).not.toThrow();
    await transport.stop();

    expect(originalStderrWrite).toHaveBeenCalledWith(
      '[FileConsoleTransport] Failed to write log to file: disk unavailable\n',
      'utf8',
    );
  });

  it('should keep the original writers when directory initialization fails', async () => {
    fileSystem.mkdir.mockRejectedValueOnce(new Error('permission denied'));
    const originalStdoutWrite = stdout.write;
    const originalStderrWrite = stderr.write;
    const transport = new FileConsoleTransport({
      cwd: '/workspace',
      fileSystem: asFileSystemAdapter(fileSystem),
      now: () => new Date('2026-05-06T14:24:19.000Z'),
      stderr,
      stdout,
    });

    await transport.start();

    expect(stdout.write).toBe(originalStdoutWrite);
    expect(stderr.write).toBe(originalStderrWrite);
    expect(originalStderrWrite).toHaveBeenCalledWith(
      '[FileConsoleTransport] Failed to write log to file: permission denied\n',
      'utf8',
    );
  });
});
