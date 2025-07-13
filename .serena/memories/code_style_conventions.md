# Code Style and Conventions

## NestJS Patterns
- **Controllers**: Use decorators (@Controller, @Post, @Get, etc.)
- **Services**: Injectable classes with @Injectable() decorator
- **Guards**: Implement CanActivate interface, use @UseGuards()
- **DTOs**: Data Transfer Objects with class-validator decorators
- **Entities**: Sequelize models with TypeScript decorators

## TypeScript Standards
- **Strict typing**: All functions must have return types
- **Interface definitions**: Use interfaces for contracts
- **Enums**: Use TypeScript enums for fixed sets of values
- **Async/Await**: Prefer async/await over Promises

## Security Patterns
- **Authentication**: All protected routes use @UseGuards(JwtAuthGuard)
- **Authorization**: Use @UseGuards(PermissionsGuard) with @RequirePermissions()
- **Multi-tenant**: Every query MUST include company_id WHERE clause
- **Input validation**: All DTOs use class-validator decorators

## Database Conventions
- **Naming**: snake_case for database fields, camelCase for TypeScript
- **Timestamps**: All tables have created_at, updated_at
- **Soft Deletes**: Use paranoid: true (deleted_at field)
- **UUIDs**: Primary keys use UUID type
- **Foreign Keys**: Always reference with proper constraints

## Testing Conventions
- **TDD**: Write failing test first, implement, refactor
- **Co-location**: Unit tests alongside source files (.spec.ts)
- **E2E**: End-to-end tests in test/ directory
- **Mocks**: Use unified mock guards for consistent testing
- **Coverage**: Minimum 90% unit test coverage required