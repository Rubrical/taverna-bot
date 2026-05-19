import { ApplicationError } from '../../../../common/errors';

export class PlayerAlreadyOnTableError extends ApplicationError {
  constructor(message: string) {
    super(message);
  }
}
