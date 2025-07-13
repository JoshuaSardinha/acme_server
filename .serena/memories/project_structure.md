# Project Structure Overview

## Root Directory
```
national_niner_server/
├── src/                    # Source code
├── test/                   # Comprehensive test suite
├── config/                 # Sequelize configuration
├── migrations/             # Database migrations (legacy)
├── docs/                   # Documentation
├── .vscode/               # VS Code settings
├── package.json           # Dependencies and scripts
├── CLAUDE.md             # Development instructions
└── README.md             # Project documentation
```

## Source Code Structure (`src/`)
```
src/
├── main.ts               # Application entry point
├── app.module.ts         # Root application module
├── core/                 # Core infrastructure
│   ├── guards/          # Authentication & authorization guards
│   ├── decorators/      # Custom decorators
│   └── exceptions/      # Custom exception classes
├── common/              # Shared utilities
│   ├── dto/            # Common DTOs
│   ├── filters/        # Exception filters
│   ├── interceptors/   # Response interceptors
│   ├── decorators/     # Common decorators
│   └── services/       # Shared services
├── modules/            # Feature modules
│   ├── auth/          # Authentication module
│   ├── company/       # Company management
│   ├── team/          # Team management
│   ├── role/          # Role & permissions
│   ├── access-control/ # Business validation
│   ├── health/        # Health checks
│   └── config/        # Configuration endpoints
├── database/          # Database configuration
└── models/            # Legacy Sequelize models (being migrated)
```

## Test Structure (`test/`)
```
test/
├── auth/              # Authentication tests
├── e2e/              # End-to-end tests
├── integration/      # Integration tests
├── security/         # Security & penetration tests
├── performance/      # Performance tests
├── database/         # Database tests
├── entities/         # Entity unit tests
├── utils/           # Test utilities
├── factories/       # Test data factories
└── helpers/         # Test helpers
```

## Module Pattern
Each feature module follows NestJS conventions:
- `module.ts` - Module definition
- `controller.ts` - HTTP endpoints
- `service.ts` - Business logic
- `entities/` - Database entities
- `dto/` - Data transfer objects
- `*.spec.ts` - Unit tests