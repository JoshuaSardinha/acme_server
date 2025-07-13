# Module Architecture Refactoring

## Overview

This document describes the module architecture refactoring performed to resolve circular dependency issues that were causing E2E test failures.

## Problem Statement

### Issue Description
- E2E tests were failing due to circular dependency issues in the module structure
- The `CommonModule` contained `BusinessValidationGuard` which depended on services from `CompanyModule` and `TeamModule`
- This violated the unidirectional dependency principle where a "common" module should not depend on feature-specific modules

### Root Cause Analysis
1. **Test Type Confusion**: Tests in `test/` directory are integration/E2E tests, not unit tests
2. **Database Configuration Differences**:
   - Entity tests use SQLite in-memory database (more forgiving)
   - E2E tests use real MySQL database (strict validation)
3. **Module Dependency Anti-Pattern**: CommonModule depending on feature modules created circular dependencies

## Solution Implementation

### Architectural Changes

#### 1. Created AccessControlModule
- New module to handle cross-domain business validation logic
- Located at: `src/modules/access-control/`
- Contains: `BusinessValidationGuard` and related validation logic

#### 2. Refactored CommonModule
- Removed `BusinessValidationGuard` and its dependencies
- Now only contains truly common, stateless services:
  - `BusinessErrorService`
  - `BusinessTransactionService`

#### 3. Updated Module Hierarchy
```
AppModule
├── CommonModule (global, stateless services)
├── CoreModule (guards, interceptors)
├── CompanyModule (exports: CompanyValidationService)
├── TeamModule (exports: TeamValidationService, MembershipValidationService)
├── AccessControlModule (imports: CompanyModule, TeamModule)
└── Other feature modules...
```

### Benefits

1. **Eliminated Circular Dependencies**: Clear unidirectional dependency flow
2. **Improved Testability**: E2E tests can now bootstrap the full application
3. **Better Separation of Concerns**: Access control logic isolated in dedicated module
4. **Maintained API Compatibility**: No external-facing changes

## Testing Strategy Clarification

### Test Organization
- **Unit Tests** (`src/**/*.spec.ts`): Mock all dependencies, test in isolation
- **Integration/E2E Tests** (`test/**/*.spec.ts`): Test with real dependencies

### Database Strategy (Updated)
- **All Tests**: Now use MySQL exclusively for consistency
- **SQLite Support**: Completely removed from the application
- **Benefits**: 
  - Ensures all tests use the same database engine as production
  - Catches MySQL-specific constraints and behavior
  - Eliminates false positives from SQLite's more permissive validation

## Migration Notes

### For Developers
1. Import `BusinessValidationGuard` from `@modules/access-control` instead of `@common`
2. The `BusinessValidation` decorator is also exported from the same module
3. No changes required to controller usage

### Example Usage
```typescript
import { BusinessValidation, BusinessValidationGuard } from '@modules/access-control';

@Controller('teams')
@UseGuards(JwtAuthGuard, BusinessValidationGuard)
export class TeamController {
  @Post(':teamId/members')
  @BusinessValidation({ validateTeamMembership: true })
  async addMember() {
    // ...
  }
}
```