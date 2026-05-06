export interface Repository<TEntity, TResult = TEntity, TId = string, TCriteria = unknown> {
  save(entity: TEntity): Promise<TResult>;
  findById(id: TId): Promise<TResult | null>;
  findMany(criteria: TCriteria): Promise<readonly TResult[]>;
}
