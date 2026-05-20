import { Module } from '@nestjs/common';

import { TableModule } from './table/table.module.js';

@Module({
  imports: [TableModule],
})
export class RpgModule {}
