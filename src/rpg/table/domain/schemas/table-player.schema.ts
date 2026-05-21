import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import type { TablePlayerState } from '../entities/table-player.entity.js';

export type TablePlayerDocument = HydratedDocument<TablePlayerPersistence>;

@Schema()
export class TablePlayerPersistence {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  userDiscordId: string;

  @Prop({ required: true, enum: ['active', 'banned', 'absent'], type: String })
  status: TablePlayerState;

  @Prop({ required: true })
  version: number;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const TablePlayerSchema = SchemaFactory.createForClass(TablePlayerPersistence);
