import { TablePlayer } from '../../../../src/rpg/table/domain/entities/table-player.entity.js';

describe('TablePlayer', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates an active table player', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    const tablePlayer = new TablePlayer('Player One', 'discord-player-1');

    expect(tablePlayer.username).toBe('Player One');
    expect(tablePlayer.userDiscordId).toBe('discord-player-1');
    expect(tablePlayer.status).toBe('active');
    expect(tablePlayer.version).toBe(1);
    expect(tablePlayer.createdAt).toEqual(now);
    expect(tablePlayer.updatedAt).toEqual(now);
  });

  it('restores a table player with persisted state', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    const tablePlayer = TablePlayer.restore({
      id: 'player-id',
      username: 'Player One',
      userDiscordId: 'discord-player-1',
      createdAt,
      updatedAt,
      version: 3,
      status: 'absent',
    });

    expect(tablePlayer.id).toBe('player-id');
    expect(tablePlayer.username).toBe('Player One');
    expect(tablePlayer.userDiscordId).toBe('discord-player-1');
    expect(tablePlayer.createdAt).toEqual(createdAt);
    expect(tablePlayer.updatedAt).toEqual(updatedAt);
    expect(tablePlayer.version).toBe(3);
    expect(tablePlayer.status).toBe('absent');
  });

  it('changes username and updates control fields', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const tablePlayer = new TablePlayer('Player One', 'discord-player-1');

    const updatedAt = new Date('2026-01-02T00:00:00.000Z');
    jest.setSystemTime(updatedAt);
    tablePlayer.changeUsername('Player Two');

    expect(tablePlayer.username).toBe('Player Two');
    expect(tablePlayer.updatedAt).toEqual(updatedAt);
    expect(tablePlayer.version).toBe(2);
  });

  it('changes status and updates control fields', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const tablePlayer = new TablePlayer('Player One', 'discord-player-1');

    const updatedAt = new Date('2026-01-02T00:00:00.000Z');
    jest.setSystemTime(updatedAt);
    tablePlayer.changePlayerStatus('banned');

    expect(tablePlayer.status).toBe('banned');
    expect(tablePlayer.updatedAt).toEqual(updatedAt);
    expect(tablePlayer.version).toBe(2);
  });
});
