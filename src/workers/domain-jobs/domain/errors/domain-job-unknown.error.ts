import { ApplicationError } from '../../../../common/errors';

export class DomainJobUnknownError extends ApplicationError {
  constructor(message: string) {
    super(message, { code: 'DOMAIN_JOB_UNKNOWN_ERROR' });
  }
}
