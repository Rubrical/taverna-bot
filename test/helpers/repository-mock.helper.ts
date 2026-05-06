type RepositoryMethodMock<TMethod> = TMethod extends (...args: infer Args) => infer Result
  ? jest.Mock<Result, Args>
  : never;

export type RepositoryMock<TRepository> = {
  [TKey in keyof TRepository]: RepositoryMethodMock<TRepository[TKey]>;
};

export function createRepositoryMock<TRepository>(methods: RepositoryMock<TRepository>): RepositoryMock<TRepository> {
  return methods;
}
