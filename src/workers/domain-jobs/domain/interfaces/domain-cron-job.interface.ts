// All Cron Jobs should implement this contract
export interface DomainCronJob {
  readonly name: string;
  readonly cronExpression: string;
  run(): Promise<void>;
}
