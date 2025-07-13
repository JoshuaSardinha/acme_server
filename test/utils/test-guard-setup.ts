import { TestingModuleBuilder } from '@nestjs/testing';
import { JwtAuthGuard } from '../../src/core/guards/jwt-auth.guard';
import { CompanyAdminGuard } from '../../src/core/guards/company-admin.guard';
import { TeamAccessGuard, TeamManagerGuard } from '../../src/core/guards/team-access.guard';
import { RolesGuard } from '../../src/core/guards/roles.guard';
import {
  UnifiedMockJwtAuthGuard,
  UnifiedMockCompanyAdminGuard,
  UnifiedMockTeamAccessGuard,
  UnifiedMockTeamManagerGuard,
  UnifiedMockRolesGuard,
} from '../auth/unified-test-guards';

/**
 * Consistent guard override setup for E2E tests
 *
 * This utility ensures all guards are consistently overridden across all test files,
 * preventing conflicts and ensuring proper test isolation.
 *
 * Usage:
 * ```typescript
 * const moduleFixture: TestingModule = await Test.createTestingModule({
 *   imports: [AppModule],
 *   providers: [DbCleanerService],
 * });
 *
 * setupTestGuards(moduleFixture);
 *
 * const app = moduleFixture.compile();
 * ```
 */

export function setupTestGuards(moduleBuilder: TestingModuleBuilder): TestingModuleBuilder {
  return (
    moduleBuilder
      // Core authentication guard - used by all modules
      .overrideGuard(JwtAuthGuard)
      .useClass(UnifiedMockJwtAuthGuard)

      // Company admin guard - used by Company, Role, and Team modules
      .overrideGuard(CompanyAdminGuard)
      .useClass(UnifiedMockCompanyAdminGuard)

      // Team-specific guards - used by Team module
      .overrideGuard(TeamAccessGuard)
      .useClass(UnifiedMockTeamAccessGuard)

      .overrideGuard(TeamManagerGuard)
      .useClass(UnifiedMockTeamManagerGuard)

      // Role-based guard - if used by any module
      .overrideGuard(RolesGuard)
      .useClass(UnifiedMockRolesGuard)
  );
}

/**
 * Alternative setup for modules that only need basic authentication
 * Use this for auth and basic modules that don't need company/team guards
 */
export function setupBasicTestGuards(moduleBuilder: TestingModuleBuilder): TestingModuleBuilder {
  return moduleBuilder.overrideGuard(JwtAuthGuard).useClass(UnifiedMockJwtAuthGuard);
}

/**
 * Setup for company-level operations (Company and Role modules)
 */
export function setupCompanyTestGuards(moduleBuilder: TestingModuleBuilder): TestingModuleBuilder {
  return moduleBuilder
    .overrideGuard(JwtAuthGuard)
    .useClass(UnifiedMockJwtAuthGuard)

    .overrideGuard(CompanyAdminGuard)
    .useClass(UnifiedMockCompanyAdminGuard);
}

/**
 * Full setup for team operations (Team module)
 */
export function setupTeamTestGuards(moduleBuilder: TestingModuleBuilder): TestingModuleBuilder {
  return moduleBuilder
    .overrideGuard(JwtAuthGuard)
    .useClass(UnifiedMockJwtAuthGuard)

    .overrideGuard(CompanyAdminGuard)
    .useClass(UnifiedMockCompanyAdminGuard)

    .overrideGuard(TeamAccessGuard)
    .useClass(UnifiedMockTeamAccessGuard)

    .overrideGuard(TeamManagerGuard)
    .useClass(UnifiedMockTeamManagerGuard);
}
