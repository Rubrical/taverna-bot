import { TablePlayer } from './table-player.entity.js';
import { PlayerAlreadyOnTableError } from '../errors/player-already-on-table-error';
import { TableNonUpdatableError } from '../errors/table-non-updatable-error';

export interface TableCreate {
  readonly guildDiscordId: string;
  readonly systemName: string;
  readonly masterDiscordId: string;
  readonly name?: string;
  readonly players: Array<{ readonly playerDiscordId: string; readonly playerName: string }>;
}

export interface TableRestore {
  readonly id: string;
  readonly name?: string;
  readonly version: number;
  readonly systemName: string;
  readonly guildDiscordId: string;
  readonly masterDiscordId: string;
  readonly players: TablePlayer[];
  readonly status: TableStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt?: Date;
}

export type TableStatus = 'active' | 'archived';

export class Table {
  public readonly MAX_PLAYERS = 7;
  public readonly MIN_PLAYERS = 2;

  private _id: string;
  private _name?: string;
  private _version: number;
  private readonly _systemName: string;
  // todo: private sheetSchema: object;
  private readonly _guildDiscordId: string;
  private readonly _masterDiscordId: string;
  private _players: TablePlayer[];
  private _status: TableStatus;

  private _createdAt: Date;
  private _updatedAt: Date;
  private _archivedAt?: Date;

  constructor(props: TableCreate) {
    const now = new Date();
    this._createdAt = now;
    this._updatedAt = now;
    this._version = 1;
    this._status = 'active';

    this._name = props.name;
    this._masterDiscordId = props.masterDiscordId;
    this._guildDiscordId = props.guildDiscordId;
    this._systemName = props.systemName;
    this._players = props.players.map((player) => new TablePlayer(player.playerName, player.playerDiscordId));
  }

  static restore(props: TableRestore): Table {
    const table = new Table({
      guildDiscordId: props.guildDiscordId,
      systemName: props.systemName,
      masterDiscordId: props.masterDiscordId,
      name: props.name,
      players: [],
    });
    table._id = props.id;
    table._createdAt = props.createdAt;
    table._updatedAt = props.updatedAt;
    table._version = props.version;
    table._players = props.players;
    table._status = props.status;
    table._archivedAt = props.archivedAt;

    return table;
  }

  addPlayer(newPlayer: TablePlayer): void {
    this.assertTableIsUpdatable();

    const validPlayers = this._players.filter((p) => p.status === 'active').length;
    if (validPlayers >= this.MAX_PLAYERS) {
      throw new TableNonUpdatableError('Table limit players already reached');
    }

    const playerExists = this._players.some((p) => p.username === newPlayer.username);
    if (playerExists) {
      throw new PlayerAlreadyOnTableError('Player already exists at the table');
    }

    this._players.push(newPlayer);
    this.updateActions();
  }

  inactivatePlayer(userDiscordId: string): void {
    this.assertTableIsUpdatable();

    const validPlayers = this._players.filter((p) => p.status === 'active').length;
    if (validPlayers <= this.MIN_PLAYERS) {
      throw new TableNonUpdatableError('Table limit players already reached');
    }

    const player = this._players.find((p) => p.userDiscordId === userDiscordId && p.status === 'active');
    if (!player) {
      throw new TableNonUpdatableError('Player is not active at the table');
    }

    player.changePlayerStatus('absent');
    this.updateActions();
  }

  archive(): void {
    this.assertTableIsUpdatable();

    this._status = 'archived';
    this._archivedAt = new Date();
    this.updateActions();
  }

  private assertTableIsUpdatable(): void {
    if (this._status === 'archived') {
      throw new TableNonUpdatableError('This table is archived and cannot be updated');
    }
  }

  private updateActions(): void {
    this._updatedAt = new Date(Date.now());
    this._version++;
  }

  // getters

  get id(): string {
    return this._id;
  }

  get name(): string | undefined {
    return this._name;
  }

  get version(): number {
    return this._version;
  }

  get systemName(): string {
    return this._systemName;
  }

  get guildDiscordId(): string {
    return this._guildDiscordId;
  }

  get masterDiscordId(): string {
    return this._masterDiscordId;
  }

  get players(): TablePlayer[] {
    return this._players;
  }

  get status(): TableStatus {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get archivedAt(): Date | undefined {
    return this._archivedAt;
  }
}
