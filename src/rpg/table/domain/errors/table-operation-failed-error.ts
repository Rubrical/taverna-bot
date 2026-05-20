import { ApplicationError } from '../../../../common/errors/index.js';

export class TableOperationFailedError extends ApplicationError {
  constructor(reason: string) {
    super('Table operation failed', { code: 'TABLE_OPERATION_FAILED', reason });
  }
}
