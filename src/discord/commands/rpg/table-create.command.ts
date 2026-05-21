import { CACHE_MANAGER, type Cache } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import {
  ActionRowBuilder,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type User,
  type UserSelectMenuInteraction,
} from 'discord.js';
import {
  ComponentParam,
  Context,
  Modal,
  Subcommand,
  UserSelect,
  type ModalContext,
  type SlashCommandContext,
  type UserSelectContext,
} from 'necord';
import { randomUUID } from 'node:crypto';

import { cacheKeys } from '../../../infrastructure/cache/cache-keys.js';
import { TavernaLogger } from '../../../logger/infrastructure/taverna-logger.service.js';
import { TableService } from '../../../rpg/table/application/table.service.js';
import { TableOperationFailedError } from '../../../rpg/table/domain/errors/table-operation-failed-error.js';
import { RpgCommand } from '../../commands-decorators/rpg-command.decorator.js';

interface TableCreateDraft {
  readonly name: string;
  readonly systemName: string;
  readonly guildDiscordId: string;
  readonly masterDiscordId: string;
}

@RpgCommand({ name: 'table', description: 'Manage RPG tables' })
@Injectable()
export class RpgTableCreateCommand {
  static readonly TABLE_NAME_INPUT_ID = 'rpg-table-create-name';
  static readonly SYSTEM_NAME_INPUT_ID = 'rpg-table-create-system';
  static readonly CREATE_MODAL_ID = 'rpg/table/create';
  static readonly PLAYERS_SELECT_CUSTOM_ID_PREFIX = 'rpg/table/create/players';
  static readonly TABLE_NAME_MAX_LENGTH = 80;
  static readonly SYSTEM_NAME_MAX_LENGTH = 40;
  static readonly MIN_PLAYERS = 2;
  static readonly MAX_PLAYERS = 7;

  private readonly _draftTtlInMilliseconds = 10 * 60 * 1000;

  constructor(
    private readonly _tableService: TableService,
    @Inject(CACHE_MANAGER) private readonly _cache: Cache,
    private readonly _logger: TavernaLogger,
  ) {
    this._logger.setContext(RpgTableCreateCommand.name);
  }

  @Subcommand({ name: 'create', description: 'Create a new RPG table' })
  async execute(@Context() [interaction]: SlashCommandContext): Promise<void> {
    await interaction.showModal(this.buildCreateTableModal());
  }

  @Modal(RpgTableCreateCommand.CREATE_MODAL_ID)
  async onCreateModal(@Context() [interaction]: ModalContext): Promise<void> {
    const name = interaction.fields.getTextInputValue(RpgTableCreateCommand.TABLE_NAME_INPUT_ID).trim();
    const systemName = interaction.fields.getTextInputValue(RpgTableCreateCommand.SYSTEM_NAME_INPUT_ID).trim();
    const validationError = this.validateModalInput(name, systemName);

    if (validationError) {
      await interaction.reply({ content: validationError, ephemeral: true });
      return;
    }

    if (!interaction.guildId) {
      await interaction.reply({ content: 'This command can only be used inside a Discord server.', ephemeral: true });
      return;
    }

    const draftId = await this.createDraft({
      name,
      systemName,
      guildDiscordId: interaction.guildId,
      masterDiscordId: interaction.user.id,
    });

    await interaction.reply({
      content: 'Select the players for this table.',
      components: [this.buildPlayersSelectRow(draftId)],
      ephemeral: true,
    });
  }

  @UserSelect(`${RpgTableCreateCommand.PLAYERS_SELECT_CUSTOM_ID_PREFIX}/:draftId`)
  async onPlayersSelected(
    @Context() [interaction]: UserSelectContext,
    @ComponentParam('draftId') draftId: string,
  ): Promise<void> {
    const draft = await this.consumeDraft(draftId);

    if (!draft) {
      await this.updateSelectInteraction(
        interaction,
        'This table creation request expired. Run `/rpg table create` again.',
      );
      return;
    }

    const selectedUsers = [...interaction.users.values()];
    const validationError = this.validateSelectedPlayers(selectedUsers, draft.masterDiscordId);

    if (validationError) {
      await this.updateSelectInteraction(interaction, validationError);
      return;
    }

    try {
      const table = await this._tableService.createTable({
        guildDiscordId: draft.guildDiscordId,
        masterDiscordId: draft.masterDiscordId,
        name: draft.name,
        systemName: draft.systemName,
        players: selectedUsers.map((user) => ({
          playerDiscordId: user.id,
          playerName: user.username,
        })),
      });

      await this.updateSelectInteraction(interaction, `Table "${table.name ?? draft.name}" created successfully.`);
    } catch (error) {
      this._logger.error('Failed to create RPG table from Discord command', this.normalizeError(error), {
        kind: 'audit',
        guildDiscordId: draft.guildDiscordId,
        masterDiscordId: draft.masterDiscordId,
      });
      await this.updateSelectInteraction(interaction, 'Could not create the table. Try again later.');
    }
  }

  private buildCreateTableModal(): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(RpgTableCreateCommand.CREATE_MODAL_ID)
      .setTitle('Create RPG table')
      .addLabelComponents(
        new LabelBuilder()
          .setLabel('Table name')
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId(RpgTableCreateCommand.TABLE_NAME_INPUT_ID)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(RpgTableCreateCommand.TABLE_NAME_MAX_LENGTH),
          ),
        new LabelBuilder()
          .setLabel('System name')
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId(RpgTableCreateCommand.SYSTEM_NAME_INPUT_ID)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(RpgTableCreateCommand.SYSTEM_NAME_MAX_LENGTH),
          ),
      );
  }

  private buildPlayersSelectRow(draftId: string): ActionRowBuilder<UserSelectMenuBuilder> {
    return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`${RpgTableCreateCommand.PLAYERS_SELECT_CUSTOM_ID_PREFIX}/${draftId}`)
        .setPlaceholder('Select players')
        .setMinValues(RpgTableCreateCommand.MIN_PLAYERS)
        .setMaxValues(RpgTableCreateCommand.MAX_PLAYERS),
    );
  }

  private validateModalInput(name: string, systemName: string): string | null {
    if (!name) {
      return 'Table name is required.';
    }

    if (name.length > RpgTableCreateCommand.TABLE_NAME_MAX_LENGTH) {
      return `Table name must have at most ${RpgTableCreateCommand.TABLE_NAME_MAX_LENGTH} characters.`;
    }

    if (!systemName) {
      return 'System name is required.';
    }

    if (systemName.length > RpgTableCreateCommand.SYSTEM_NAME_MAX_LENGTH) {
      return `System name must have at most ${RpgTableCreateCommand.SYSTEM_NAME_MAX_LENGTH} characters.`;
    }

    return null;
  }

  private validateSelectedPlayers(selectedUsers: readonly User[], masterDiscordId: string): string | null {
    if (
      selectedUsers.length < RpgTableCreateCommand.MIN_PLAYERS ||
      selectedUsers.length > RpgTableCreateCommand.MAX_PLAYERS
    ) {
      return `Select between ${RpgTableCreateCommand.MIN_PLAYERS} and ${RpgTableCreateCommand.MAX_PLAYERS} players.`;
    }

    if (selectedUsers.some((user) => user.id === masterDiscordId)) {
      return 'The table master cannot be selected as a player.';
    }

    const uniqueUserIds = new Set(selectedUsers.map((user) => user.id));
    if (uniqueUserIds.size !== selectedUsers.length) {
      return 'Select each player only once.';
    }

    return null;
  }

  private async createDraft(draft: TableCreateDraft): Promise<string> {
    const draftId = randomUUID();
    await this._cache.set(cacheKeys.rpg.tableCreateDraft(draftId), draft, this._draftTtlInMilliseconds);

    return draftId;
  }

  private async consumeDraft(draftId: string): Promise<TableCreateDraft | null> {
    const cacheKey = cacheKeys.rpg.tableCreateDraft(draftId);
    const draft = await this._cache.get<TableCreateDraft>(cacheKey);
    await this._cache.del(cacheKey);

    return draft ?? null;
  }

  private async updateSelectInteraction(interaction: UserSelectMenuInteraction, content: string): Promise<void> {
    await interaction.update({
      content,
      components: [],
    });
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new TableOperationFailedError(String(error));
  }
}
