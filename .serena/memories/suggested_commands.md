# Suggested Commands for National Niner Backend

## Development Commands
```bash
# Start development server with hot-reload
npm run start:dev

# Start with debugger
npm run start:debug

# Build TypeScript
npm run build
```

## Database Commands
```bash
# Run database migrations
npx sequelize-cli db:migrate

# Create new migration
npx sequelize-cli migration:generate --name migration-name
```

## Testing Commands
```bash
# Unit tests
npm test

# Unit tests with watch mode (TDD)
npm run test:watch

# Unit tests with coverage
npm run test:cov

# End-to-end tests
npm run test:e2e

# Integration tests
npm run test:integration

# All tests (slow, comprehensive)
npm run test:all-slow

# Security tests
npm run test:security

# Performance tests
npm run test:performance
```

## Code Quality Commands
```bash
# Linting (fix issues)
npm run lint

# Code formatting
npm run format
```

## Validation Commands (MANDATORY before task completion)
```bash
# Server must start without errors
npm run start:dev

# Health check
curl localhost:3000/health

# All tests must pass
npm run test:all-slow
```

## System Commands (Darwin/macOS)
- `ls` - list directory contents
- `find` - search for files
- `grep` - search text in files (prefer `rg` ripgrep if available)
- `git` - version control operations
- `cd` - change directory