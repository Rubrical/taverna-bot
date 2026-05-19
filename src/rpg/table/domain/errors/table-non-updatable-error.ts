import { ApplicationError } from '../../../../common/errors';

export class TableNonUpdatableError extends ApplicationError {
  constructor(message: string) {
    super(message);
  }
}
