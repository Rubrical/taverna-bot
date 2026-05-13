import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import type { LogLevel } from '../../../../common/types/index.js';
import type { LogKind } from '../../../../logger/domain/interfaces/log-entry.interface.js';

export type SystemLogDocument = HydratedDocument<SystemLog>;

@Schema({ collection: 'system_logs' })
export class SystemLog {
  @Prop({ required: true, type: String, enum: ['log', 'error', 'warn', 'debug', 'verbose'] })
  level: LogLevel;

  @Prop({ required: true })
  message: string;

  @Prop()
  context?: string;

  @Prop({ default: 'system', enum: ['system', 'audit'], type: String })
  kind?: LogKind;

  @Prop({ required: true })
  timestamp: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const SystemLogSchema = SchemaFactory.createForClass(SystemLog);
