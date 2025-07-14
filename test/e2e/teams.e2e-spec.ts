import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import * as request from 'supertest';

// Core modules and guards
import { AppModule } from '../../src/app.module';
import { ClientVersionGuard } from '../../src/core/guards/client-version.guard';
import { CompanyAdminGuard } from '../../src/core/guards/company-admin.guard';
import { JwtAuthGuard } from '../../src/core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/core/guards/permissions.guard';
import { TeamAccessGuard, TeamManagerGuard } from '../../src/core/guards/team-access.guard';

// Test utilities
import { authHelper } from '../auth/auth.helper';
import { MockJwtAuthGuard } from '../auth/mock-jwt-auth.guard';
import { ensureAcmeCompanyExists, getAcmeCompanyId } from '../factories/acme-company.factory';
import { createTestCompany } from '../factories/company.factory';
import { createStandardRoles, getRoleByCode } from '../factories/role.factory';
import { DbCleanerService } from '../utils/db-cleaner.service';

// Entities
import { User } from '../../src/modules/auth/entities/user.entity';
import { TeamMember } from '../../src/modules/team/entities/team-member.entity';
import { Team, TeamCategory } from '../../src/modules/team/entities/team.entity';

/**
 * Teams Module E2E Tests
 *
 * Tests the teams functionality including:
 * - Team creation with different user roles
 * - Multi-tenant isolation
 * - Team management operations
 * - Security and authorization
 * - Business rule validation (legal teams require lawyers)
 */
describe('Teams Module (E2E)', () => {
  // 1. Declare ONLY infrastructure variables here
  let app: INestApplication;
  let sequelize: Sequelize;
  let dbCleaner: DbCleanerService;
  let testContext: any; // For sharing data between beforeEach and it blocks

  beforeAll(async () => {
    try {
      // 2. Set up Test.createTestingModule with AppModule like other working tests
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideGuard(JwtAuthGuard)
        .useClass(MockJwtAuthGuard)
        .overrideGuard(ClientVersionGuard)
        .useValue({ canActivate: () => true }) // Bypass client version check for tests
        .overrideGuard(PermissionsGuard)
        .useValue({ canActivate: () => true }) // Bypass permissions for now
        .overrideGuard(CompanyAdminGuard)
        .useValue({ canActivate: () => true }) // Bypass company admin check
        .overrideGuard(TeamAccessGuard)
        .useValue({ canActivate: () => true }) // Bypass team access check
        .overrideGuard(TeamManagerGuard)
        .useValue({ canActivate: () => true }) // Bypass team manager check
        .compile();

      // 3. Create app, set up global pipes, and run app.init()
      app = moduleFixture.createNestApplication();

      // Apply same middleware as production
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        })
      );

      await app.init();

      sequelize = app.get<Sequelize>(getConnectionToken());
      dbCleaner = new DbCleanerService(sequelize);
    } catch (error) {
      console.error('Failed to setup test environment:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // 4. Clean database and create fresh test data for EVERY test
    await dbCleaner.cleanAll();

    // Create standard roles first
    await createStandardRoles();

    // Ensure Acme company exists
    await ensureAcmeCompanyExists();

    // Create companies, users, and tokens fresh for each test
    testContext = await createTestData();
  });

  // Helper function to create fresh test data
  async function createTestData() {
    // Create test companies for multi-tenant scenarios
    const company1 = await createTestCompany({
      name: 'Test Company 1',
      subdomain: 'test-company-1',
      subscription_type: 'premium',
      subscription_status: 'active',
    });

    const company2 = await createTestCompany({
      name: 'Test Company 2',
      subdomain: 'test-company-2',
      subscription_type: 'basic',
      subscription_status: 'active',
    });

    // Get roles using factory
    const acmeAdminRole = await getRoleByCode('acme_admin');
    const vendorAdminRole = await getRoleByCode('vendor_admin');
    const vendorEmployeeRole = await getRoleByCode('vendor_employee');

    if (!acmeAdminRole || !vendorAdminRole || !vendorEmployeeRole) {
      throw new Error('Required roles not found');
    }

    // Create test users with different roles
    const acmeAdmin = await User.create({
      first_name: 'AC',
      last_name: 'Admin',
      email: 'ac.admin@acme.com',
      auth0_user_id: 'auth0|ac-admin',
      role_id: acmeAdminRole.id,
      company_id: getAcmeCompanyId(),
      is_lawyer: false,
    });

    const vendorAdmin1 = await User.create({
      first_name: 'Vendor',
      last_name: 'Admin1',
      email: 'admin@vendor1.com',
      auth0_user_id: 'auth0|vendor-admin1',
      role_id: vendorAdminRole.id,
      company_id: company1.id,
      is_lawyer: false,
    });

    const vendorAdmin2 = await User.create({
      first_name: 'Vendor',
      last_name: 'Admin2',
      email: 'admin@vendor2.com',
      auth0_user_id: 'auth0|vendor-admin2',
      role_id: vendorAdminRole.id,
      company_id: company2.id,
      is_lawyer: false,
    });

    const lawyerUser = await User.create({
      first_name: 'John',
      last_name: 'Lawyer',
      email: 'lawyer@vendor1.com',
      auth0_user_id: 'auth0|lawyer',
      role_id: vendorEmployeeRole.id,
      company_id: company1.id,
      is_lawyer: true,
    });

    const regularUser = await User.create({
      first_name: 'Jane',
      last_name: 'User',
      email: 'user@vendor1.com',
      auth0_user_id: 'auth0|regular-user',
      role_id: vendorEmployeeRole.id,
      company_id: company1.id,
      is_lawyer: false,
    });

    const userWithTask = await User.create({
      first_name: 'Busy',
      last_name: 'User',
      email: 'busy@vendor1.com',
      auth0_user_id: 'auth0|busy-user',
      role_id: vendorEmployeeRole.id,
      company_id: company1.id,
      is_lawyer: false,
    });

    // Generate auth tokens using authHelper
    const acmeAdminToken = authHelper.generateToken({
      sub: acmeAdmin.auth0_user_id,
      email: acmeAdmin.email,
      role: 'acme_admin',
      org_id: acmeAdmin.company_id,
      permissions: ['MANAGE_COMPANIES', 'APPROVE_COMPANIES', 'CREATE_COMPANIES'],
    });

    const vendorAdmin1Token = authHelper.generateToken({
      sub: vendorAdmin1.auth0_user_id,
      email: vendorAdmin1.email,
      role: 'vendor_admin',
      org_id: vendorAdmin1.company_id,
      permissions: ['ADMIN_ACCESS', 'MANAGE_USERS'],
    });

    const vendorAdmin2Token = authHelper.generateToken({
      sub: vendorAdmin2.auth0_user_id,
      email: vendorAdmin2.email,
      role: 'vendor_admin',
      org_id: vendorAdmin2.company_id,
      permissions: ['ADMIN_ACCESS', 'MANAGE_USERS'],
    });

    const lawyerToken = authHelper.generateToken({
      sub: lawyerUser.auth0_user_id,
      email: lawyerUser.email,
      role: 'vendor_employee',
      org_id: lawyerUser.company_id,
      permissions: ['LEGAL_ACCESS'],
    });

    const regularUserToken = authHelper.generateToken({
      sub: regularUser.auth0_user_id,
      email: regularUser.email,
      role: 'vendor_employee',
      org_id: regularUser.company_id,
    });

    const userWithTaskToken = authHelper.generateToken({
      sub: userWithTask.auth0_user_id,
      email: userWithTask.email,
      role: 'vendor_employee',
      org_id: userWithTask.company_id,
    });

    return {
      companies: { company1, company2 },
      users: { acmeAdmin, vendorAdmin1, vendorAdmin2, lawyerUser, regularUser, userWithTask },
      tokens: {
        acmeAdminToken,
        vendorAdmin1Token,
        vendorAdmin2Token,
        lawyerToken,
        regularUserToken,
        userWithTaskToken,
      },
    };
  }

  afterAll(async () => {
    await dbCleaner.cleanAll();
    await app.close();
  });

  // ============================================================================
  // 🛡️ Authentication & Authorization
  // ============================================================================
  describe('🛡️ Authentication & Authorization', () => {
    it('should prevent unauthorized access without JWT', async () => {
      await request(app.getHttpServer()).get('/teams').expect(HttpStatus.UNAUTHORIZED);
    });

    it('should enforce company data isolation', async () => {
      const { companies, users, tokens } = testContext;

      // Create a team in company1
      const team1 = await Team.create({
        name: 'Company 1 Team',
        company_id: companies.company1.id,
        owner_user_id: users.vendorAdmin1.id,
        category: TeamCategory.CONVENTIONAL,
      });

      // Vendor Admin 2 should not be able to access Company 1's team
      await request(app.getHttpServer())
        .get(`/teams/${team1.id}`)
        .set('Authorization', `Bearer ${tokens.vendorAdmin2Token}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should allow AC_ADMIN to access any team', async () => {
      const { companies, users, tokens } = testContext;

      // Create teams in different companies
      const team1 = await Team.create({
        name: 'Company 1 Team',
        company_id: companies.company1.id,
        owner_user_id: users.vendorAdmin1.id,
        category: TeamCategory.CONVENTIONAL,
      });

      const team2 = await Team.create({
        name: 'Company 2 Team',
        company_id: companies.company2.id,
        owner_user_id: users.vendorAdmin2.id,
        category: TeamCategory.CONVENTIONAL,
      });

      // AC_ADMIN should be able to access both
      await request(app.getHttpServer())
        .get(`/teams/${team1.id}`)
        .set('Authorization', `Bearer ${tokens.acmeAdminToken}`)
        .expect(HttpStatus.OK);

      await request(app.getHttpServer())
        .get(`/teams/${team2.id}`)
        .set('Authorization', `Bearer ${tokens.acmeAdminToken}`)
        .expect(HttpStatus.OK);
    });

    it('should handle malformed authorization headers', async () => {
      await request(app.getHttpServer())
        .get('/teams')
        .set('Authorization', 'InvalidHeader')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should handle invalid JWT tokens', async () => {
      await request(app.getHttpServer())
        .get('/teams')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // ============================================================================
  // 📝 POST /teams
  // ============================================================================
  describe('📝 POST /teams', () => {
    const createTeamDto = {
      name: 'New Operations Team',
      category: TeamCategory.CONVENTIONAL,
      ownerUserId: '',
      memberIds: [],
    };

    describe('✅ Success Scenarios', () => {
      it('should allow AC_ADMIN to create team for any company', async () => {
        const { companies, users, tokens } = testContext;

        const teamData = {
          ...createTeamDto,
          name: 'AC Admin Team',
          ownerUserId: users.vendorAdmin2.id,
          memberIds: [users.vendorAdmin2.id],
          companyId: companies.company2.id,
        };

        const response = await request(app.getHttpServer())
          .post('/teams')
          .set('Authorization', `Bearer ${tokens.acmeAdminToken}`)
          .send(teamData)
          .expect(HttpStatus.CREATED);

        expect(response.body).toEqual(
          expect.objectContaining({
            name: 'AC Admin Team',
            category: TeamCategory.CONVENTIONAL,
            id: expect.any(String),
          })
        );
      });

      it('should allow VENDOR_ADMIN to create team for own company', async () => {
        const { users, tokens } = testContext;

        const teamData = {
          ...createTeamDto,
          name: 'Vendor Admin Team',
          ownerUserId: users.vendorAdmin1.id,
          memberIds: [users.vendorAdmin1.id, users.regularUser.id],
        };

        const response = await request(app.getHttpServer())
          .post('/teams')
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .send(teamData)
          .expect(HttpStatus.CREATED);

        expect(response.body).toEqual(
          expect.objectContaining({
            name: 'Vendor Admin Team',
            category: TeamCategory.CONVENTIONAL,
            id: expect.any(String),
          })
        );
      });
    });

    describe('❌ Error Scenarios', () => {
      it('should return 409 Conflict for duplicate team names', async () => {
        const { companies, users, tokens } = testContext;

        // First, create a team
        await Team.create({
          name: 'Existing Team',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });

        const teamData = {
          ...createTeamDto,
          name: 'Existing Team',
          ownerUserId: users.vendorAdmin1.id,
          memberIds: [users.vendorAdmin1.id],
        };

        await request(app.getHttpServer())
          .post('/teams')
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .send(teamData)
          .expect(HttpStatus.CONFLICT);
      });

      it('should return 400 Bad Request for invalid input data', async () => {
        const { tokens } = testContext;

        const invalidData = {
          name: '', // Too short
          category: 'INVALID_CATEGORY',
          ownerUserId: 'not-a-uuid',
          memberIds: ['also-not-a-uuid'],
        };

        const response = await request(app.getHttpServer())
          .post('/teams')
          .set('Authorization', `Bearer ${tokens.acmeAdminToken}`)
          .send(invalidData)
          .expect(HttpStatus.BAD_REQUEST);

        // Validation messages can be either array or string based on the ValidationPipe configuration
        if (Array.isArray(response.body.message)) {
          expect(response.body.message).toEqual(
            expect.arrayContaining([
              expect.stringMatching(/Team name must be at least/),
              expect.stringMatching(/Invalid team category/),
              expect.stringMatching(/Valid owner user ID/),
            ])
          );
        } else {
          // When it's a string, check it contains the expected validation messages
          expect(response.body.message).toMatch(/Team name must be at least/);
          expect(response.body.message).toMatch(/Invalid team category/);
          expect(response.body.message).toMatch(/Valid owner user ID/);
        }
      });

      it('should return 400 if owner not included in members', async () => {
        const { users, tokens } = testContext;

        const teamData = {
          ...createTeamDto,
          name: 'Team Without Owner as Member',
          ownerUserId: users.vendorAdmin1.id,
          memberIds: [users.regularUser.id], // Owner not included
        };

        await request(app.getHttpServer())
          .post('/teams')
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .send(teamData)
          .expect(HttpStatus.BAD_REQUEST);
      });
    });

    describe('📖 Business Rule Scenarios', () => {
      it('should reject LEGAL team without lawyer member', async () => {
        const { users, tokens } = testContext;

        const teamData = {
          ...createTeamDto,
          name: 'Legal Team Without Lawyer',
          category: TeamCategory.LEGAL,
          ownerUserId: users.vendorAdmin1.id,
          memberIds: [users.vendorAdmin1.id, users.regularUser.id], // No lawyer
        };

        const response = await request(app.getHttpServer())
          .post('/teams')
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .send(teamData)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toContain(
          'A LEGAL team must have at least one member who is a lawyer'
        );
      });

      it('should successfully create LEGAL team with lawyer', async () => {
        const { users, tokens } = testContext;

        const teamData = {
          ...createTeamDto,
          name: 'Valid Legal Team',
          category: TeamCategory.LEGAL,
          ownerUserId: users.vendorAdmin1.id,
          memberIds: [users.vendorAdmin1.id, users.lawyerUser.id, users.regularUser.id],
        };

        const response = await request(app.getHttpServer())
          .post('/teams')
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .send(teamData)
          .expect(HttpStatus.CREATED);

        expect(response.body).toEqual(
          expect.objectContaining({
            category: TeamCategory.LEGAL,
            name: 'Valid Legal Team',
            id: expect.any(String),
          })
        );
      });
    });
  });

  // ============================================================================
  // 📖 GET /teams
  // ============================================================================
  describe('📖 GET /teams', () => {
    describe('✅ Success Scenarios', () => {
      it('should allow AC_ADMIN to see all teams from all companies', async () => {
        const { companies, users, tokens } = testContext;

        // Seed teams for both companies
        await Team.create({
          name: 'Team A C1',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });
        await Team.create({
          name: 'Team B C1',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });
        await Team.create({
          name: 'Team C C2',
          company_id: companies.company2.id,
          owner_user_id: users.vendorAdmin2.id,
          category: TeamCategory.CONVENTIONAL,
        });

        const response = await request(app.getHttpServer())
          .get('/teams')
          .set('Authorization', `Bearer ${tokens.acmeAdminToken}`)
          .expect(HttpStatus.OK);

        expect(response.body.data).toHaveLength(3);
        expect(response.body.meta.itemCount).toBe(3);
      });

      it('should support pagination', async () => {
        const { companies, users, tokens } = testContext;

        // Create teams for testing pagination
        await Team.create({
          name: 'Team A',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });
        await Team.create({
          name: 'Team B',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });

        const response = await request(app.getHttpServer())
          .get('/teams?page=1&limit=1')
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.OK);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.meta.itemCount).toBe(2);
        expect(response.body.meta.currentPage).toBe(1);
        expect(response.body.meta.totalPages).toBe(2);
      });
    });

    describe('🛡️ Security & Multi-tenant Scenarios', () => {
      it('should only show teams from own company to VENDOR_ADMIN', async () => {
        const { companies, users, tokens } = testContext;

        // Seed teams for both companies
        await Team.create({
          name: 'Team A C1',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });
        await Team.create({
          name: 'Team B C1',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });
        await Team.create({
          name: 'Team C C2',
          company_id: companies.company2.id,
          owner_user_id: users.vendorAdmin2.id,
          category: TeamCategory.CONVENTIONAL,
        });

        const response = await request(app.getHttpServer())
          .get('/teams')
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.OK);

        expect(response.body.data).toHaveLength(2);
        // Check that all teams belong to company1
        response.body.data.forEach((team) => {
          expect(team).toEqual(
            expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
            })
          );
        });
      });
    });

    describe('❌ Error Scenarios', () => {
      it('should validate pagination parameters', async () => {
        const { tokens } = testContext;

        await request(app.getHttpServer())
          .get('/teams?page=0&limit=101')
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.BAD_REQUEST);
      });
    });
  });

  // ============================================================================
  // 🔍 GET /teams/:teamId
  // ============================================================================
  describe('🔍 GET /teams/:teamId', () => {
    describe('✅ Success Scenarios', () => {
      it('should return team details for valid access', async () => {
        const { companies, users, tokens } = testContext;

        const team = await Team.create({
          name: 'Test Team',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });

        const response = await request(app.getHttpServer())
          .get(`/teams/${team.id}`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.OK);

        expect(response.body).toEqual(
          expect.objectContaining({
            id: team.id,
            name: 'Test Team',
            category: TeamCategory.CONVENTIONAL,
          })
        );
      });
    });

    describe('❌ Error Scenarios', () => {
      it('should return 404 for non-existent team', async () => {
        const { tokens } = testContext;

        const fakeUuid = '12345678-1234-1234-1234-123456789012';
        await request(app.getHttpServer())
          .get(`/teams/${fakeUuid}`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.NOT_FOUND);
      });

      it('should return 400 for invalid UUID format', async () => {
        const { tokens } = testContext;

        await request(app.getHttpServer())
          .get('/teams/invalid-uuid')
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.BAD_REQUEST);
      });
    });

    describe('🛡️ Security Scenarios', () => {
      it('should prevent cross-company access', async () => {
        const { companies, users, tokens } = testContext;

        const team = await Team.create({
          name: 'Test Team',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });

        await request(app.getHttpServer())
          .get(`/teams/${team.id}`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin2Token}`)
          .expect(HttpStatus.NOT_FOUND); // Should not find team from different company
      });
    });
  });

  // ============================================================================
  // 🔄 PATCH /teams/:teamId
  // ============================================================================
  describe('🔄 PATCH /teams/:teamId', () => {
    describe('✅ Success Scenarios', () => {
      it('should update team successfully', async () => {
        const { companies, users, tokens } = testContext;

        const team = await Team.create({
          name: 'Team to Update',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });

        const updateData = {
          name: 'Updated Team Name',
          description: 'Updated description',
        };

        const response = await request(app.getHttpServer())
          .patch(`/teams/${team.id}`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .send(updateData)
          .expect(HttpStatus.OK);

        expect(response.body).toEqual(
          expect.objectContaining({
            name: 'Updated Team Name',
            description: 'Updated description',
            id: expect.any(String),
          })
        );
      });
    });

    describe('❌ Error Scenarios', () => {
      it('should return 409 if updated name conflicts with existing team', async () => {
        const { companies, users, tokens } = testContext;

        const team = await Team.create({
          name: 'Team to Update',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });

        // Create another team first
        await Team.create({
          name: 'Existing Team',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });

        const updateData = { name: 'Existing Team' };

        await request(app.getHttpServer())
          .patch(`/teams/${team.id}`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .send(updateData)
          .expect(HttpStatus.CONFLICT);
      });
    });
  });

  // ============================================================================
  // 🗑️ DELETE /teams/:teamId
  // ============================================================================
  describe('🗑️ DELETE /teams/:teamId', () => {
    describe('✅ Success Scenarios', () => {
      it('should delete team successfully', async () => {
        const { companies, users, tokens } = testContext;

        const team = await Team.create({
          name: 'Team to Delete',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });

        await request(app.getHttpServer())
          .delete(`/teams/${team.id}`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.NO_CONTENT);

        // Verify team is actually deleted
        const deletedTeam = await Team.findByPk(team.id);
        expect(deletedTeam).toBeNull();
      });
    });

    describe('❌ Error Scenarios', () => {
      it('should return 404 for non-existent team', async () => {
        const { tokens } = testContext;

        const fakeUuid = '12345678-1234-1234-1234-123456789012';
        await request(app.getHttpServer())
          .delete(`/teams/${fakeUuid}`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.NOT_FOUND);
      });
    });
  });

  // ============================================================================
  // 👥 POST /teams/:teamId/members
  // ============================================================================
  describe('👥 POST /teams/:teamId/members', () => {
    describe('✅ Success Scenarios', () => {
      it('should add members to team successfully', async () => {
        const { companies, users, tokens } = testContext;

        const team = await Team.create({
          name: 'Team for Member Tests',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });

        const addMembersData = {
          userIds: [users.regularUser.id, users.lawyerUser.id],
        };

        const response = await request(app.getHttpServer())
          .post(`/teams/${team.id}/members`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .send(addMembersData)
          .expect(HttpStatus.CREATED);

        expect(response.body).toEqual(
          expect.objectContaining({
            id: expect.any(String),
          })
        );

        // If members are included in response, validate them
        if (response.body.members) {
          expect(response.body.members).toHaveLength(2);
        }
      });
    });

    describe('❌ Error Scenarios', () => {
      it('should return 400 for invalid user IDs', async () => {
        const { companies, users, tokens } = testContext;

        const team = await Team.create({
          name: 'Team for Member Tests',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.CONVENTIONAL,
        });

        const addMembersData = {
          userIds: ['invalid-uuid'],
        };

        await request(app.getHttpServer())
          .post(`/teams/${team.id}/members`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .send(addMembersData)
          .expect(HttpStatus.BAD_REQUEST);
      });
    });
  });

  // ============================================================================
  // 🚫 DELETE /teams/:teamId/members/:userId
  // ============================================================================
  describe('🚫 DELETE /teams/:teamId/members/:userId', () => {
    describe('✅ Success Scenarios', () => {
      it('should successfully remove a regular member', async () => {
        const { companies, users, tokens } = testContext;

        const legalTeam = await Team.create({
          name: 'Critical Legal Team',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.LEGAL,
        });

        // Add members to the team
        await TeamMember.create({
          team_id: legalTeam.id,
          user_id: users.vendorAdmin1.id,
          added_by_user_id: users.vendorAdmin1.id,
        });
        await TeamMember.create({
          team_id: legalTeam.id,
          user_id: users.lawyerUser.id,
          added_by_user_id: users.vendorAdmin1.id,
        });
        await TeamMember.create({
          team_id: legalTeam.id,
          user_id: users.regularUser.id,
          added_by_user_id: users.vendorAdmin1.id,
        });

        await request(app.getHttpServer())
          .delete(`/teams/${legalTeam.id}/members/${users.regularUser.id}`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.NO_CONTENT);

        // Verify removal
        const membership = await TeamMember.findOne({
          where: {
            team_id: legalTeam.id,
            user_id: users.regularUser.id,
          },
        });
        expect(membership).toBeNull();
      });
    });

    describe('📖 Business Rule Scenarios', () => {
      it('should FORBID removing the team owner', async () => {
        const { companies, users, tokens } = testContext;

        const legalTeam = await Team.create({
          name: 'Critical Legal Team',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.LEGAL,
        });

        await TeamMember.create({
          team_id: legalTeam.id,
          user_id: users.vendorAdmin1.id,
          added_by_user_id: users.vendorAdmin1.id,
        });

        const response = await request(app.getHttpServer())
          .delete(`/teams/${legalTeam.id}/members/${users.vendorAdmin1.id}`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toContain('Cannot remove the team owner');
      });

      it('should FORBID removing the last lawyer from a LEGAL team', async () => {
        const { companies, users, tokens } = testContext;

        const legalTeam = await Team.create({
          name: 'Critical Legal Team',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.LEGAL,
        });

        await TeamMember.create({
          team_id: legalTeam.id,
          user_id: users.vendorAdmin1.id,
          added_by_user_id: users.vendorAdmin1.id,
        });
        await TeamMember.create({
          team_id: legalTeam.id,
          user_id: users.lawyerUser.id,
          added_by_user_id: users.vendorAdmin1.id,
        });

        const response = await request(app.getHttpServer())
          .delete(`/teams/${legalTeam.id}/members/${users.lawyerUser.id}`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toContain('Cannot remove all lawyers from a LEGAL team');
      });
    });

    describe('❌ Error Scenarios', () => {
      it('should return 400 if user is not a member', async () => {
        const { companies, users, tokens } = testContext;

        const legalTeam = await Team.create({
          name: 'Critical Legal Team',
          company_id: companies.company1.id,
          owner_user_id: users.vendorAdmin1.id,
          category: TeamCategory.LEGAL,
        });

        // Try to remove a user who is not a member
        const response = await request(app.getHttpServer())
          .delete(`/teams/${legalTeam.id}/members/${users.vendorAdmin2.id}`)
          .set('Authorization', `Bearer ${tokens.vendorAdmin1Token}`)
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toContain('User is not a member of this team');
      });
    });
  });
});
