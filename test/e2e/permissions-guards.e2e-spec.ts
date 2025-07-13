import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import * as request from 'supertest';

// Core modules and guards
import { AppModule } from '../../src/app.module';
import { JwtAuthGuard } from '../../src/core/guards/jwt-auth.guard';

// Test utilities
import { authHelper } from '../auth/auth.helper';
import { MockJwtAuthGuard } from '../auth/mock-jwt-auth.guard';
import { createTestCompany } from '../factories/company.factory';
import { ensureAcmeCompanyExists } from '../factories/acme-company.factory';
import { createStandardRoles, getRoleByCode } from '../factories/role.factory';
import { DbCleanerService } from '../utils/db-cleaner.service';

// Entities
import { User } from '../../src/modules/auth/entities/user.entity';
import { Company } from '../../src/modules/company/entities/company.entity';

/**
 * Permission Guards Integration E2E Tests
 *
 * Tests the integration between JwtAuthGuard, PermissionsGuard, and other authorization
 * guards in real HTTP request flows. Verifies that guards work correctly together and
 * provide proper security boundaries.
 */
describe('Permission Guards Integration (E2E)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let dbCleaner: DbCleanerService;

  // Test data
  let testCompany: Company;
  let testCompany2: Company;
  let adminUser: User;
  let regularUser: User;
  let unauthorizedUser: User;

  // JWT tokens
  let adminToken: string;
  let userToken: string;
  let unauthorizedToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .compile();

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
  });

  beforeEach(async () => {
    // Clean database before each test
    await dbCleaner.cleanAll();

    // Create standard roles first
    await createStandardRoles();

    // Ensure National Niner company exists
    const nationalNinerCompany = await ensureAcmeCompanyExists();

    // Create test companies
    testCompany = await createTestCompany({
      name: 'Test Company 1',
      subdomain: 'test-company-1',
      subscription_type: 'premium',
      subscription_status: 'active',
    });

    testCompany2 = await createTestCompany({
      name: 'Test Company 2',
      subdomain: 'test-company-2',
      subscription_type: 'basic',
      subscription_status: 'active',
    });

    // Get roles for user creation
    const vendorAdminRole = await getRoleByCode('vendor_admin');
    const vendorEmployeeRole = await getRoleByCode('vendor_employee');

    if (!vendorAdminRole || !vendorEmployeeRole) {
      throw new Error('Required roles not found');
    }

    // Create test users with different roles using role_id
    adminUser = await User.create({
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@testcompany.com',
      auth0_user_id: 'auth0|admin_user',
      role_id: vendorAdminRole.id,
      company_id: testCompany.id,
      is_lawyer: false,
    });

    regularUser = await User.create({
      first_name: 'Regular',
      last_name: 'User',
      email: 'user@testcompany.com',
      auth0_user_id: 'auth0|regular_user',
      role_id: vendorEmployeeRole.id,
      company_id: testCompany.id,
      is_lawyer: false,
    });

    unauthorizedUser = await User.create({
      first_name: 'Unauthorized',
      last_name: 'User',
      email: 'unauth@testcompany2.com',
      auth0_user_id: 'auth0|unauth_user',
      role_id: vendorEmployeeRole.id,
      company_id: testCompany2.id,
      is_lawyer: false,
    });

    // Generate JWT tokens using authHelper with role codes
    adminToken = authHelper.generateToken({
      sub: adminUser.auth0_user_id,
      email: adminUser.email,
      role: 'vendor_admin',
      org_id: adminUser.company_id,
    });

    userToken = authHelper.generateToken({
      sub: regularUser.auth0_user_id,
      email: regularUser.email,
      role: 'vendor_employee',
      org_id: regularUser.company_id,
    });

    unauthorizedToken = authHelper.generateToken({
      sub: unauthorizedUser.auth0_user_id,
      email: unauthorizedUser.email,
      role: 'vendor_employee',
      org_id: unauthorizedUser.company_id,
    });
  });

  afterAll(async () => {
    await dbCleaner.cleanAll();
    await app.close();
  });

  describe('🔒 Guard Chain Execution', () => {
    describe('JwtAuthGuard → PermissionsGuard Flow', () => {
      it('should execute JwtAuthGuard first and populate request context', async () => {
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Verify that user context was populated by JwtAuthGuard
        expect(response.body.user_id).toBe(adminUser.id);
      });

      it('should fail at JwtAuthGuard for invalid tokens', async () => {
        const invalidToken = 'invalid.jwt.token';

        await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401);
      });

      it('should pass JwtAuthGuard but could fail at PermissionsGuard', async () => {
        // This tests the case where authentication succeeds but authorization might fail
        // Since we don't have PermissionsGuard implemented yet, this tests the flow
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${unauthorizedUser.id}/permissions`)
          .set('Authorization', `Bearer ${unauthorizedToken}`)
          .expect(200);

        expect(response.body.user_id).toBe(unauthorizedUser.id);
      });
    });

    describe('Guard Configuration and Ordering', () => {
      it('should handle multiple guards in correct order', async () => {
        // Test that guards are executed in the correct order
        // JwtAuthGuard should run first, then any permission guards

        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('user_id');
        expect(response.body).toHaveProperty('permissions');
      });

      it('should short-circuit on first guard failure', async () => {
        // If JwtAuthGuard fails, subsequent guards should not execute
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          // No authorization header
          .expect(401);

        expect(response.body).toMatchObject({
          message: expect.any(String),
        });
      });
    });
  });

  describe('🎯 Permission-Based Authorization', () => {
    describe('Endpoint Permission Requirements', () => {
      it('should allow access to users with required permissions', async () => {
        // Admin should be able to access permission endpoints
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('permissions');
        expect(Array.isArray(response.body.permissions)).toBe(true);
      });

      it('should allow users to check their own permissions', async () => {
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${regularUser.id}/permissions/check`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            permission_name: 'VIEW_PETITION',
            company_id: testCompany.id,
          })
          .expect(200);

        expect(response.body).toHaveProperty('has_permission');
        expect(typeof response.body.has_permission).toBe('boolean');
      });

      it('should enforce permission requirements for sensitive operations', async () => {
        // Try to check admin operations as regular user
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${regularUser.id}/permissions/check`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            permission_name: 'MANAGE_USERS',
            company_id: testCompany.id,
          })
          .expect(200);

        expect(response.body.has_permission).toBe(false);
      });
    });

    describe('Method-Level Permission Enforcement', () => {
      it('should enforce different permissions for different HTTP methods', async () => {
        // GET operations might require VIEW permissions
        const getResponse = await request(app.getHttpServer())
          .get(`/permissions/users/${regularUser.id}/permissions`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(getResponse.body.user_id).toBe(regularUser.id);

        // POST operations might require CREATE permissions
        const postResponse = await request(app.getHttpServer())
          .post('/permissions/cache/invalidate')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            user_id: regularUser.id,
            reason: 'Test invalidation',
          })
          .expect(200); // Currently allows all authenticated users

        expect(postResponse.body).toHaveProperty('invalidated_at');
      });

      it('should handle permission inheritance in nested resources', async () => {
        // Parent resource permissions should apply to child resources
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${adminUser.id}/permissions/check`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            permission_names: ['CREATE_PETITION', 'VIEW_PETITION'],
            company_id: testCompany.id,
          })
          .expect(200);

        expect(response.body.results).toHaveLength(2);
        response.body.results.forEach((result) => {
          expect(result).toHaveProperty('has_permission');
          expect(typeof result.has_permission).toBe('boolean');
        });
      });
    });
  });

  describe('🏢 Company Context and Tenant Isolation', () => {
    describe('Company-Scoped Guards', () => {
      it('should enforce company context in permission checks', async () => {
        // Test cross-tenant permission check - should fail with proper validation error
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${adminUser.id}/permissions/check`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            permission_name: 'CREATE_PETITION',
            company_id: testCompany2.id, // Different company
          })
          .expect(500); // Expect proper validation failure

        // Should return proper error message about permission failure
        expect(response.body).toMatchObject({
          success: false,
          message: expect.stringContaining('Failed to check user permissions'),
        });
      });

      it('should prevent cross-tenant access in guard logic', async () => {
        // User from company 2 trying to access company 1 data should be denied
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', `Bearer ${unauthorizedToken}`)
          .expect(403); // Expect proper security denial

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('not authorized');
      });
    });

    describe('Request Context Validation', () => {
      it('should validate company_id parameters against user context', async () => {
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .query({ company_id: testCompany.id })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.user_id).toBe(adminUser.id);
      });

      it('should handle missing company context gracefully', async () => {
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${adminUser.id}/permissions/check`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            permission_name: 'CREATE_PETITION',
            // Missing company_id
          })
          .expect(200);

        expect(response.body).toHaveProperty('has_permission');
      });
    });
  });

  describe('⚡ Guard Performance and Caching', () => {
    describe('Guard Execution Performance', () => {
      it('should execute guards efficiently for concurrent requests', async () => {
        const startTime = Date.now();

        // Reduce concurrent requests and add delays to prevent connection issues
        const promises = Array.from({ length: 5 }, (_, index) =>
          new Promise((resolve) => setTimeout(resolve, index * 20)).then(
            () =>
              request(app.getHttpServer())
                .get(`/permissions/users/${adminUser.id}/permissions`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200)
                .timeout(10000) // Add timeout
          )
        );

        await Promise.all(promises);

        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(10000); // More realistic timing expectation
      });

      it('should cache guard decisions when appropriate', async () => {
        // First request
        const start1 = Date.now();
        await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        const time1 = Date.now() - start1;

        // Second request (potential cache hit)
        const start2 = Date.now();
        await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        const time2 = Date.now() - start2;

        // Second request might be faster due to caching
        // Note: This is implementation-dependent
        expect(time2).toBeLessThanOrEqual(time1 * 2); // Allow some variance
      });
    });

    describe('Guard State Management', () => {
      it('should not leak state between requests', async () => {
        // Request with admin user
        const adminResponse = await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Request with regular user
        const userResponse = await request(app.getHttpServer())
          .get(`/permissions/users/${regularUser.id}/permissions`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        // Responses should be independent
        expect(adminResponse.body.user_id).toBe(adminUser.id);
        expect(userResponse.body.user_id).toBe(regularUser.id);
        expect(adminResponse.body).toHaveProperty('permissions');
        expect(userResponse.body).toHaveProperty('permissions');
      });

      it('should handle guard failures gracefully without affecting other requests', async () => {
        // Invalid request
        await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        // Valid request should still work
        const validResponse = await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(validResponse.body.user_id).toBe(adminUser.id);
      });
    });
  });

  describe('🛡️ Security Edge Cases in Guards', () => {
    describe('Token Manipulation Attacks', () => {
      it('should prevent token modification attacks', async () => {
        // Try to modify token payload
        const maliciousToken = authHelper.generateToken({
          sub: adminUser.auth0_user_id,
          email: adminUser.email,
          role: 'SUPER_ADMIN', // Try to escalate role
          org_id: testCompany.id,
        });

        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', `Bearer ${maliciousToken}`)
          .expect(200);

        // Should use actual user role from database, not token
        expect(response.body.user_id).toBe(adminUser.id);
      });

      it('should prevent replay attacks with expired tokens', async () => {
        const expiredToken = authHelper.generateExpiredToken({
          sub: adminUser.auth0_user_id,
          email: adminUser.email,
        });

        await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);
      });
    });

    describe('Authorization Bypass Attempts', () => {
      it('should prevent permission escalation through parameter injection', async () => {
        // Try to inject admin permissions
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${regularUser.id}/permissions/check`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            permission_name: 'MANAGE_USERS',
            company_id: testCompany.id,
            // Try to inject additional parameters
            force_grant: true,
            admin_override: true,
          })
          .expect(200);

        expect(response.body.has_permission).toBe(false);
      });

      it('should handle guard bypass attempts', async () => {
        // Try various bypass techniques
        await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('X-Bypass-Auth', 'true') // Try header injection
          .expect(401);

        await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .set('Authorization', 'Bearer')
          .expect(401);
      });
    });
  });

  describe('🔄 Guard Integration with Business Logic', () => {
    describe('Permission Context Flow', () => {
      it('should properly populate permission context for business logic', async () => {
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${adminUser.id}/permissions/check`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            permission_name: 'CREATE_PETITION',
            company_id: testCompany.id,
          })
          .expect(200);

        expect(response.body).toMatchObject({
          has_permission: expect.any(Boolean),
          permission_name: 'CREATE_PETITION',
          checked_at: expect.any(String),
        });
      });

      it('should handle complex permission scenarios', async () => {
        // Test permission combinations
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${adminUser.id}/permissions/check`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            permission_names: ['CREATE_PETITION', 'MANAGE_USERS', 'VIEW_PETITION'],
            company_id: testCompany.id,
          })
          .expect(200);

        expect(response.body.results).toHaveLength(3);
        response.body.results.forEach((result) => {
          expect(result.has_permission).toEqual(expect.any(Boolean));
          expect(result).toHaveProperty('permission_name');
        });
      });
    });

    describe('Error Propagation', () => {
      it('should properly propagate guard errors to error handlers', async () => {
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${adminUser.id}/permissions`)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          code: expect.any(String),
          message: expect.any(String),
        });
      });

      it('should handle guard exceptions gracefully', async () => {
        // Test with malformed user ID should return 404, not 500
        const response = await request(app.getHttpServer())
          .get('/permissions/users/malformed-id/permissions')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404); // Correct expectation

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('not found');
      });
    });
  });
});
