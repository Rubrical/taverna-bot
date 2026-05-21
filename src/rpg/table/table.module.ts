import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { TableService } from './application/table.service.js';
import { TablePersistence, TableSchema } from './domain/schemas/table.schema.js';
import { TableRepository } from './infrastructure/repositories/table.repository.js';

@Module({
  imports: [DatabaseModule, MongooseModule.forFeature([{ name: TablePersistence.name, schema: TableSchema }])],
  providers: [TableRepository, TableService],
  exports: [TableService],
})
export class TableModule {}
