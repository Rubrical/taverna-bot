import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TablePersistence, TableSchema } from './domain/schemas/table.schema.js';
import { TableRepository } from './infrastructure/repositories/table.repository.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: TablePersistence.name, schema: TableSchema }])],
  providers: [TableRepository],
  exports: [TableRepository],
})
export class TableModule {}
