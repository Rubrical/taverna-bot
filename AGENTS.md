# AGENTS.md — Taverna Bot Code Conventions

This document defines the coding standards and architectural conventions for the **Taverna Bot** project. All contributors (human and AI) **must** follow these rules.

---

## 1. Language & Naming

- **All code identifiers** (variables, functions, classes, interfaces, enums, constants, file names) **must be in English**.
- Comments and documentation may be in Portuguese (pt-BR) when targeting non-technical stakeholders, but code-level comments should prefer English.

### Naming Conventions

| Element             | Convention     | Example                          |
|---------------------|----------------|----------------------------------|
| Files & directories | `kebab-case`   | `log-processor.controller.ts`    |
| Classes             | `PascalCase`   | `LogProcessorController`         |
| Interfaces          | `PascalCase`   | `LogEntry` (no `I` prefix)       |
| Variables, params   | `camelCase`    | `systemLogModel`                 |
| Constants           | `UPPER_SNAKE`  | `SYSTEM_LOGS_QUEUE`              |
| Enums               | `PascalCase`   | `LogLevel`                       |
| Enum members        | `PascalCase`   | `LogLevel.Error`                 |

---

## 2. Code Style

### Early Returns

Always prefer **early returns** over deep nesting or else chains. Exit the function as soon as an invalid/edge case is detected.

```typescript
// ✅ Good
function processUser(user: User | null): Result {
  if (!user) {
    return Result.fail('User not found');
  }

  if (!user.isActive) {
    return Result.fail('User is inactive');
  }

  return Result.ok(user);
}

// ❌ Bad
function processUser(user: User | null): Result {
  if (user) {
    if (user.isActive) {
      return Result.ok(user);
    } else {
      return Result.fail('User is inactive');
    }
  } else {
    return Result.fail('User not found');
  }
}
```

### Custom Errors

- **Never** use bare `throw new Error(...)`.
- Always extend `ApplicationError` (from `src/common/errors/`) or create a domain-specific subclass.
- Each error must have a unique `code` string (e.g., `'USER_NOT_FOUND'`, `'INVALID_CHARACTER_SHEET'`).

```typescript
// ✅ Good
export class UserNotFoundError extends ApplicationError {
  constructor(userId: string) {
    super(`User ${userId} not found`, 'USER_NOT_FOUND', 404);
  }
}

// ❌ Bad
throw new Error('User not found');
```

### POJOs (Plain Old JavaScript Objects)

- Use **interfaces** (not classes) for DTOs, payloads, and data-transfer shapes.
- Use classes **only** when you need behavior (methods), NestJS decorators, or Mongoose schemas.
- Prefer `readonly` properties on interfaces when data should not be mutated.

```typescript
// ✅ POJO interface
export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
}

// ❌ Unnecessary class
export class LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
}
```

### Existing contracts:
- repository at `src/common/repositories/repository.interface.ts`

---

## 3. Architecture

### DDD Layers (per module)

```
/<module-name>/
├── domain/           # Pure business logic, no framework dependencies
│   ├── interfaces/   # Contracts, value objects
│   ├── schemas/      # Mongoose schemas (domain models)
│   └── errors/       # Domain-specific errors
├── application/      # Use cases, orchestration
│   └── services/     # Application services
└── infrastructure/   # Framework-bound code
    ├── controllers/  # NestJS controllers, Necord commands
    └── repositories/ # Database access implementations
```

### Module Rules

- Each module **encapsulates** its own domain, application, and infrastructure layers.
- Cross-module communication happens via **NestJS DI** (injection tokens), **never** by importing infrastructure directly from another module.
- Modules **export services**, not repositories or controllers.
- Always use `@Global()` only for truly cross-cutting concerns (Logger, Cache, Queue).

### SOLID Principles

- **S**: Each class does one thing. Controllers handle routing, services handle logic, repositories handle data access.
- **O**: Extend behavior via new classes/modules, not by modifying existing ones.
- **L**: Subclasses of `ApplicationError` must be substitutable for the base class.
- **I**: Prefer small, focused interfaces over large ones.
- **D**: Depend on abstractions (interfaces, tokens), not concretions. Use NestJS DI tokens for cross-module deps.

---

## 4. Testing

### File Organization

```
test/
├── unit/          # Fast, isolated tests (mocked dependencies)
│   └── <module>/
│      └── <file>.spec.ts
├── integration/   # Tests with real(ish) dependencies (e.g., in-memory DB)
│   └── <module>/
│       └── <file>.spec.ts
```

### Conventions

- Test files use the `.spec.ts` extension.
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- All tests: `npm run test`
- Name test suites after the class under test: `describe('CustomLoggerService', ...)`.
- Use `jest.fn()` and NestJS `Test.createTestingModule()` for mocking.

---

## 5. Git Conventions

### Commit Messages

Follow **Conventional Commits**:

```
feat: add character sheet module
fix: correct dice roll calculation for d20
refactor: extract log shipping into dedicated service
test: add unit tests for PingCommand
docs: update AGENTS.md with testing conventions
chore: upgrade NestJS to v11.2
```

### Branch Naming

```
feat/<description>
fix/<description>
refactor/<description>
```

---

## 6. Imports

- Use **relative imports** within the same module.
- Use **relative imports** from `common/` (e.g., `../../../common/constants/...`).
- Always include the `.js` extension in import paths (required by `nodenext` module resolution).
- Order imports: external packages → common → same-module (separated by blank lines).

---

## 7. Environment & Config

- All external configuration (tokens, URLs, ports) **must** come from environment variables via `@nestjs/config`.
- **Never** hardcode secrets or connection strings.
- Use `.env.example` as the reference for required vars.
- Use `config.getOrThrow<T>()` for required variables, `config.get<T>(key, default)` for optional ones.
- Use `pnpm` for all npm actions once it is available at your environment

---

## 8. External Services usage

### Logging layer

- When the log seems needed (and it should always be needed) this project convention is to use the class `TavernaLogger`.
- Log everything that may be queryable ,for later analysis and reports, or can produce a side effect such as an error.
- File logs are saved by default on the `logs` folder.
- All `TavernaLogger` logs are sent to *system_logs* collection on the database.

### Cache Layer

- The cache module is imported globally so it doesn't need to be imported.
- When injecting the cache use the following sintax: `@Inject(CACHE_MANAGER) private readonly _cache: Cache`.
- Import both Cache and CACHE_MANAGER from the `@nestjs/cache-manager` package.
- All cache keys should be stored at the _"src/infrastructure/cache/cache-keys.ts"_ file

---

## 9. Discord Commands

- RPG grouped commands must use `@RpgCommand` from `src/discord/commands-decorators/rpg-command.decorator.ts`.
- RPG table actions must be implemented as Necord subcommands with `@Subcommand` under the `/rpg table <action>` group.
- Keep each RPG table subcommand in its own file at `src/discord/commands/rpg/`, using kebab-case names like `table-create.command.ts`.
- Command classes must follow the `Rpg<Table><Action>Command` naming pattern, such as `RpgTableCreateCommand` and `RpgTableListCommand`.
- Commands must depend on application services exported by domain modules through NestJS DI, never on repositories or infrastructure from another module.
- Use `TavernaLogger` for command failures and side effects that should be queryable later.
- Prefer `ephemeral: true` for private command flows, operational queries, validation failures, and error responses.
- Unit tests for RPG commands must live in `test/unit/discord/rpg/<command>.spec.ts`.
