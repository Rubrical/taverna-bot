import { ApplicationError } from '../../../../common/errors/application.error.js';

export class DomainJobUnknownError extends ApplicationError {
  constructor(message: string) {
    super(message, 'DOMAIN_JOB_UNKNOWN_ERROR');
  }
}
