import { ApplicationError } from '../../../../common/errors/index.js';

export class TableNotFoundError extends ApplicationError {
  constructor(tableId: string) {
    super(`Table ${tableId} not found`, { code: 'TABLE_NOT_FOUND', tableId });
  }
}
