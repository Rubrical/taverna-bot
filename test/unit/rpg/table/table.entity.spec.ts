import { Table } from '../../../../src/rpg/table/domain/entities/table.entity.js';
import { TablePlayer } from '../../../../src/rpg/table/domain/entities/table-player.entity.js';
import { PlayerAlreadyOnTableError } from '../../../../src/rpg/table/domain/errors/player-already-on-table-error.js';
import { TableNonUpdatableError } from '../../../../src/rpg/table/domain/errors/table-non-updatable-error.js';

describe('Table', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  function createTable(): Table {
    return new Table({
      guildDiscordId: 'guild-1',
      systemName: 'dnd5e',
      masterDiscordId: 'master-1',
      name: 'The Tavern',
      players: [
        { playerDiscordId: 'discord-player-1', playerName: 'Player One' },
        { playerDiscordId: 'discord-player-2', playerName: 'Player Two' },
      ],
    });
  }

  it('creates an active table with players', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    const table = createTable();

    expect(table.name).toBe('The Tavern');
    expect(table.guildDiscordId).toBe('guild-1');
    expect(table.systemName).toBe('dnd5e');
    expect(table.masterDiscordId).toBe('master-1');
    expect(table.players).toHaveLength(2);
    expect(table.status).toBe('active');
    expect(table.version).toBe(1);
    expect(table.createdAt).toEqual(now);
    expect(table.updatedAt).toEqual(now);
    expect(table.archivedAt).toBeUndefined();
  });

  it('restores a table with persisted state', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');
    const archivedAt = new Date('2026-01-03T00:00:00.000Z');
    const player = new TablePlayer('Player One', 'discord-player-1');

    const table = Table.restore({
      id: 'table-id',
      name: 'Restored Table',
      version: 4,
      systemName: 'dnd5e',
      guildDiscordId: 'guild-1',
      masterDiscordId: 'master-1',
      players: [player],
      status: 'archived',
      createdAt,
      updatedAt,
      archivedAt,
    });

    expect(table.id).toBe('table-id');
    expect(table.name).toBe('Restored Table');
    expect(table.version).toBe(4);
    expect(table.players).toEqual([player]);
    expect(table.status).toBe('archived');
    expect(table.createdAt).toEqual(createdAt);
    expect(table.updatedAt).toEqual(updatedAt);
    expect(table.archivedAt).toEqual(archivedAt);
  });

  it('adds a player and updates control fields', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const table = createTable();
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    jest.setSystemTime(updatedAt);
    table.addPlayer(new TablePlayer('Player Three', 'discord-player-3'));

    expect(table.players).toHaveLength(3);
    expect(table.players.at(-1)?.username).toBe('Player Three');
    expect(table.updatedAt).toEqual(updatedAt);
    expect(table.version).toBe(2);
  });

  it('does not add duplicated players', () => {
    const table = createTable();

    expect(() => table.addPlayer(new TablePlayer('Player One', 'discord-player-3'))).toThrow(PlayerAlreadyOnTableError);
  });

  it('does not add players above the active player limit', () => {
    const table = new Table({
      guildDiscordId: 'guild-1',
      systemName: 'dnd5e',
      masterDiscordId: 'master-1',
      players: Array.from({ length: 7 }, (_, index) => ({
        playerDiscordId: `discord-player-${index}`,
        playerName: `Player ${index}`,
      })),
    });

    expect(() => table.addPlayer(new TablePlayer('Player Eight', 'discord-player-8'))).toThrow(TableNonUpdatableError);
  });

  it('inactivates an active player and updates control fields', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const table = new Table({
      guildDiscordId: 'guild-1',
      systemName: 'dnd5e',
      masterDiscordId: 'master-1',
      players: [
        { playerDiscordId: 'discord-player-1', playerName: 'Player One' },
        { playerDiscordId: 'discord-player-2', playerName: 'Player Two' },
        { playerDiscordId: 'discord-player-3', playerName: 'Player Three' },
      ],
    });
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    jest.setSystemTime(updatedAt);
    table.inactivatePlayer('discord-player-3');

    expect(table.players[2].status).toBe('absent');
    expect(table.updatedAt).toEqual(updatedAt);
    expect(table.version).toBe(2);
  });

  it('does not inactivate players below the active player minimum', () => {
    const table = createTable();

    expect(() => table.inactivatePlayer('discord-player-1')).toThrow(TableNonUpdatableError);
  });

  it('archives the table and updates control fields', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const table = createTable();
    const archivedAt = new Date('2026-01-02T00:00:00.000Z');

    jest.setSystemTime(archivedAt);
    table.archive();

    expect(table.status).toBe('archived');
    expect(table.archivedAt).toEqual(archivedAt);
    expect(table.updatedAt).toEqual(archivedAt);
    expect(table.version).toBe(2);
  });

  it('unarchives an archived table and updates control fields', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const table = createTable();
    const archivedAt = new Date('2026-01-02T00:00:00.000Z');
    const unarchivedAt = new Date('2026-01-03T00:00:00.000Z');

    jest.setSystemTime(archivedAt);
    table.archive();

    jest.setSystemTime(unarchivedAt);
    table.unarchive();

    expect(table.status).toBe('active');
    expect(table.archivedAt).toBeUndefined();
    expect(table.updatedAt).toEqual(unarchivedAt);
    expect(table.version).toBe(3);
  });

  it('does not update active tables when unarchiving', () => {
    const table = createTable();

    table.unarchive();

    expect(table.status).toBe('active');
    expect(table.version).toBe(1);
  });

  it('does not update archived tables', () => {
    const table = createTable();
    table.archive();

    expect(() => table.addPlayer(new TablePlayer('Player Three', 'discord-player-3'))).toThrow(TableNonUpdatableError);
    expect(() => table.inactivatePlayer('discord-player-1')).toThrow(TableNonUpdatableError);
    expect(() => table.archive()).toThrow(TableNonUpdatableError);
  });
});
