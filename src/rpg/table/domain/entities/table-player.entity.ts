export interface TablePlayerRestore {
  readonly id: string;
  readonly username: string;
  readonly userDiscordId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
  readonly status: TablePlayerState;
}

export type TablePlayerState = 'active' | 'banned' | 'absent';

export class TablePlayer {
  private _id: string;
  private _username: string;
  private readonly _userDiscordId: string;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _version: number;
  private _status: TablePlayerState;
  // todo: private sheetId: string;

  constructor(username: string, userDiscordId: string) {
    const now = new Date();
    this._username = username;
    this._userDiscordId = userDiscordId;
    this._createdAt = now;
    this._updatedAt = now;
    this._version = 1;
    this._status = 'active';
  }

  changeUsername(username: string): void {
    this._username = username;
    this.updateActions();
  }

  changePlayerStatus(newStatus: TablePlayerState): void {
    this._status = newStatus;
    this.updateActions();
  }

  static restore(props: TablePlayerRestore): TablePlayer {
    const tablePlayer = new TablePlayer(props.username, props.userDiscordId);
    tablePlayer._id = props.id;
    tablePlayer._createdAt = props.createdAt;
    tablePlayer._updatedAt = props.updatedAt;
    tablePlayer._version = props.version;
    tablePlayer._status = props.status;

    return tablePlayer;
  }

  private updateActions(): void {
    this._updatedAt = new Date();
    this._version++;
  }

  //getters

  get username(): string {
    return this._username;
  }

  get userDiscordId(): string {
    return this._userDiscordId;
  }

  get id(): string {
    return this._id;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get version(): number {
    return this._version;
  }

  get status(): TablePlayerState {
    return this._status;
  }
}
