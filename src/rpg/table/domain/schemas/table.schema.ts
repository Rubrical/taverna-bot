import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import type { TableStatus } from '../entities/table.entity.js';
import { TablePlayerPersistence, TablePlayerSchema } from './table-player.schema.js';

export type TableDocument = HydratedDocument<TablePersistence>;

@Schema({ collection: 'tables' })
export class TablePersistence {
  @Prop()
  name?: string;

  @Prop({ required: true })
  version: number;

  @Prop({ required: true })
  systemName: string;

  @Prop({ required: true })
  guildDiscordId: string;

  @Prop({ required: true })
  masterDiscordId: string;

  @Prop({ required: true, type: [TablePlayerSchema] })
  players: TablePlayerPersistence[];

  @Prop({ required: true, enum: ['active', 'archived'], type: String })
  status: TableStatus;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;

  @Prop()
  archivedAt?: Date;
}

export const TableSchema = SchemaFactory.createForClass(TablePersistence);
