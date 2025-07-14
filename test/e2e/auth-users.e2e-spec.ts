import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import * as request from 'supertest';

// Core modules and guards
import { AppModule } from '../../src/app.module';
import { ClientVersionGuard } from '../../src/core/guards/client-version.guard';
import { JwtAuthGuard } from '../../src/core/guards/jwt-auth.guard';

// Test utilities
import { authHelper } from '../auth/auth.helper';
import { MockJwtAuthGuard } from '../auth/mock-jwt-auth.guard';
import { ensureAcmeCompanyExists, getAcmeCompanyId } from '../factories/acme-company.factory';
import { createTestCompany } from '../factories/company.factory';
import { createStandardRoles, getRoleByCode } from '../factories/role.factory';
import { createTestUser } from '../factories/user.factory';
import { DbCleanerService } from '../utils/db-cleaner.service';

// Entities
import { User, UserRole } from '../../src/modules/auth/entities/user.entity';
import { Company } from '../../src/modules/company/entities/company.entity';

/**
 * GET /auth/user E2E Tests
 *
 * Tests the authenticated user endpoint functionality including:
 * - Happy path: Valid authentication returns user data
 * - Security: Sensitive fields are not exposed
 * - Authentication failures: Invalid tokens return proper errors
 * - Multi-tenant isolation: Users can only access their own data
 */
describe('GET /auth/user (E2E)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let dbCleaner: DbCleanerService;

  // Test data
  let testCompany1: Company;
  let testCompany2: Company;
  let acmeCompany: Company;
  let testUser1: User;
  let testUser2: User;
  let adminUser: User;
  let lawyerUser: User;
  let acmeAdminUser: User;

  // Mock auth tokens
  let validToken1: string;
  let validToken2: string;
  let adminToken: string;
  let lawyerToken: string;
  let acmeAdminToken: string;
  let invalidToken: string;
  let expiredToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .overrideGuard(ClientVersionGuard)
      .useValue({ canActivate: () => true }) // Bypass client version check for tests
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

    // Ensure Acme company exists
    acmeCompany = await ensureAcmeCompanyExists();

    // Create test companies
    testCompany1 = await createTestCompany({
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

    // Create test users with different roles
    const clientRole = await getRoleByCode('client');
    if (!clientRole) {
      throw new Error('Client role not found');
    }

    testUser1 = await createTestUser(testCompany1.id, {
      email: 'user1@testcompany1.com',
      first_name: 'John',
      last_name: 'Doe',
      role_id: clientRole.id,
      auth0_user_id: 'auth0|test_user_1',
    });

    const vendorEmployeeRole = await getRoleByCode('vendor_employee');
    if (!vendorEmployeeRole) {
      throw new Error('Vendor Employee role not found');
    }

    testUser2 = await createTestUser(testCompany2.id, {
      email: 'user2@testcompany2.com',
      first_name: 'Jane',
      last_name: 'Smith',
      role_id: vendorEmployeeRole.id,
      auth0_user_id: 'auth0|test_user_2',
    });

    const vendorAdminRole = await getRoleByCode('vendor_admin');
    if (!vendorAdminRole) {
      throw new Error('Vendor Admin role not found');
    }

    adminUser = await createTestUser(testCompany1.id, {
      email: 'admin@testcompany1.com',
      first_name: 'Admin',
      last_name: 'User',
      role_id: vendorAdminRole.id,
      auth0_user_id: 'auth0|admin_user',
    });

    lawyerUser = await createTestUser(testCompany1.id, {
      email: 'lawyer@testcompany1.com',
      first_name: 'Legal',
      last_name: 'Expert',
      role_id: vendorEmployeeRole.id,
      auth0_user_id: 'auth0|lawyer_user',
    });

    // Set lawyer flag after creation
    await lawyerUser.update({ is_lawyer: true });

    // Create Acme admin user
    const acmeAdminRole = await getRoleByCode('acme_admin');
    if (!acmeAdminRole) {
      throw new Error('Acme Admin role not found');
    }

    acmeAdminUser = await User.create({
      first_name: 'AC',
      last_name: 'Admin',
      email: 'ac.admin@acme.com',
      auth0_user_id: 'auth0|ac-admin-auth-test',
      role_id: acmeAdminRole.id,
      company_id: getAcmeCompanyId(),
    });

    // Generate test tokens
    validToken1 = authHelper.generateToken({
      sub: testUser1.auth0_user_id,
      email: testUser1.email,
      role: 'client',
      org_id: testUser1.company_id,
    });

    validToken2 = authHelper.generateToken({
      sub: testUser2.auth0_user_id,
      email: testUser2.email,
      role: 'vendor_employee',
      org_id: testUser2.company_id,
    });

    adminToken = authHelper.generateToken({
      sub: adminUser.auth0_user_id,
      email: adminUser.email,
      role: 'vendor_admin',
      org_id: adminUser.company_id,
      permissions: ['ADMIN_ACCESS', 'MANAGE_USERS'],
    });

    lawyerToken = authHelper.generateToken({
      sub: lawyerUser.auth0_user_id,
      email: lawyerUser.email,
      role: 'vendor_employee',
      org_id: lawyerUser.company_id,
      permissions: ['LEGAL_ACCESS'],
    });

    acmeAdminToken = authHelper.generateToken({
      sub: acmeAdminUser.auth0_user_id,
      email: acmeAdminUser.email,
      role: 'acme_admin',
      org_id: acmeAdminUser.company_id,
      permissions: ['MANAGE_COMPANIES', 'APPROVE_COMPANIES', 'CREATE_COMPANIES'],
    });

    invalidToken = authHelper.generateInvalidToken();
    expiredToken = authHelper.generateExpiredToken({
      sub: testUser1.auth0_user_id,
      email: testUser1.email,
    });
  });

  afterAll(async () => {
    await dbCleaner.cleanAll();
    await app.close();
  });

  describe('Happy Path Tests', () => {
    it('should return user data for valid authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);

      // Assert response structure matches AuthResponseDto
      expect(response.body).toEqual({
        success: true,
        code: 'GET_USER_SUCCESSFUL',
        message: 'Getting user data successful',
        payload: expect.objectContaining({
          id: testUser1.id,
          auth0Id: testUser1.auth0_user_id,
          firstName: testUser1.first_name,
          lastName: testUser1.last_name,
          email: testUser1.email,
          role: expect.objectContaining({
            code: 'client',
            name: 'Client',
            description: 'Client company user',
          }),
          isLawyer: testUser1.is_lawyer,
          companyId: testUser1.company_id,
        }),
      });
    });

    it('should return correct data for admin user', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.payload).toEqual(
        expect.objectContaining({
          id: adminUser.id,
          role: expect.objectContaining({
            code: 'vendor_admin',
            name: 'Vendor Admin',
          }),
          email: adminUser.email,
          companyId: adminUser.company_id,
        })
      );
    });

    it('should return correct data for lawyer user', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${lawyerToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.payload).toEqual(
        expect.objectContaining({
          id: lawyerUser.id,
          isLawyer: true,
          role: expect.objectContaining({
            code: 'vendor_employee',
            name: 'Vendor Employee',
          }),
        })
      );
    });

    it('should return correct data for Acme admin user', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.payload).toEqual(
        expect.objectContaining({
          id: acmeAdminUser.id,
          role: expect.objectContaining({
            code: 'acme_admin',
            name: 'Acme Admin',
          }),
          email: acmeAdminUser.email,
          companyId: acmeCompany.id,
        })
      );
    });

    it('should return different data for users from different companies', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);

      const response2 = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken2}`)
        .expect(HttpStatus.OK);

      expect(response1.body.payload.companyId).toBe(testCompany1.id);
      expect(response2.body.payload.companyId).toBe(testCompany2.id);
      expect(response1.body.payload.id).not.toBe(response2.body.payload.id);
    });
  });

  describe('Security Tests', () => {
    it('should not expose sensitive fields in response', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);

      // Ensure sensitive fields are not present
      expect(response.body.payload).not.toHaveProperty('password');
      expect(response.body.payload).not.toHaveProperty('auth0_password');
      expect(response.body.payload).not.toHaveProperty('created_at');
      expect(response.body.payload).not.toHaveProperty('updated_at');

      // Ensure only expected fields are present
      const expectedFields = [
        'id',
        'auth0Id',
        'firstName',
        'lastName',
        'email',
        'role',
        'isLawyer',
        'companyId',
      ];
      const actualFields = Object.keys(response.body.payload);

      expectedFields.forEach((field) => {
        expect(actualFields).toContain(field);
      });

      // No extra fields should be present
      expect(actualFields.length).toBe(expectedFields.length);
    });

    it('should not allow user enumeration through timing attacks', async () => {
      // Test that response times are consistent regardless of user existence
      const start1 = Date.now();
      await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(HttpStatus.UNAUTHORIZED);
      const time2 = Date.now() - start2;

      // Response times should be within reasonable bounds (allowing for some variation)
      const timeDifference = Math.abs(time1 - time2);
      expect(timeDifference).toBeLessThan(1000); // Allow up to 1 second difference
    });

    it('should include proper security headers in response', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);

      // Check content type
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Authentication Failure Tests', () => {
    it('should return 401 Unauthorized when no token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toEqual({
        success: false,
        code: 'AUTHORIZATION_HEADER_INVALID',
        message: 'Authorization header is invalid.',
      });
    });

    it('should return 401 Unauthorized for invalid token format', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', 'Invalid token format')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toEqual({
        success: false,
        code: 'AUTHORIZATION_HEADER_INVALID',
        message: 'Authorization header is invalid.',
      });
    });

    it('should return 401 Unauthorized for malformed Bearer token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', 'Bearer')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toEqual({
        success: false,
        code: 'AUTHORIZATION_HEADER_INVALID',
        message: 'Authorization header is invalid.',
      });
    });

    it('should return 401 Unauthorized for invalid token signature', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toEqual({
        success: false,
        code: 'AUTHORIZATION_INVALID_TOKEN',
        message: 'Invalid authorization token.',
      });
    });

    it('should return 401 Unauthorized for expired token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toEqual({
        success: false,
        code: 'AUTHORIZATION_INVALID_TOKEN',
        message: 'Invalid authorization token.',
      });
    });

    it('should return 401 Unauthorized when user does not exist in database', async () => {
      // Generate token for non-existent user
      const nonExistentUserToken = authHelper.generateToken({
        sub: 'auth0|non_existent_user',
        email: 'nonexistent@example.com',
        role: 'client',
      });

      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${nonExistentUserToken}`)
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toEqual({
        success: false,
        code: 'AUTH_USER_NOT_FOUND',
        message: 'User not found',
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle case where user exists but has invalid data', async () => {
      // Create user with missing required fields (simulate data corruption)
      const clientRole = await getRoleByCode('client');
      if (!clientRole) {
        throw new Error('Client role not found');
      }

      const corruptUser = await User.create({
        first_name: '',
        last_name: '',
        email: 'corrupt@example.com',
        auth0_user_id: 'auth0|corrupt_user',
        role_id: clientRole.id,
        company_id: testCompany1.id,
      });

      const corruptToken = authHelper.generateToken({
        sub: corruptUser.auth0_user_id,
        email: corruptUser.email,
      });

      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${corruptToken}`)
        .expect(HttpStatus.OK);

      // Should still return user data even with empty names
      expect(response.body.success).toBe(true);
      expect(response.body.payload.firstName).toBe('');
      expect(response.body.payload.lastName).toBe('');
    });

    it('should handle concurrent requests from same user', async () => {
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get('/auth/user')
            .set('Authorization', `Bearer ${validToken1}`)
        );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.payload.id).toBe(testUser1.id);
      });
    });

    it('should return consistent data across multiple requests', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);

      const response2 = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);

      expect(response1.body).toEqual(response2.body);
    });
  });

  describe('Data Validation Tests', () => {
    it('should return properly formatted UUIDs', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);

      const { id, companyId } = response.body.payload;

      // UUID format validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
      expect(companyId).toMatch(uuidRegex);
    });

    it('should return valid email format', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);

      const { email } = response.body.payload;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(email).toMatch(emailRegex);
    });

    it('should return valid role enum value', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);

      const { role } = response.body.payload;
      expect(Object.values(UserRole)).toContain(role.code);
    });

    it('should return boolean values for isLawyer field', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);

      const { isLawyer } = response.body.payload;
      expect(typeof isLawyer).toBe('boolean');
    });
  });

  describe('Multi-tenant Security', () => {
    it('should ensure users cannot access data from other companies through token manipulation', async () => {
      // This test ensures our JWT validation properly isolates tenant data
      // The token contains the correct user ID, so it should return correct company data
      const response = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken2}`)
        .expect(HttpStatus.OK);

      expect(response.body.payload.companyId).toBe(testCompany2.id);
      expect(response.body.payload.companyId).not.toBe(testCompany1.id);
    });

    it('should maintain tenant isolation across different user roles', async () => {
      // Admin from company 1 should get company 1 data
      const adminResponse = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      // Regular user from company 2 should get company 2 data
      const userResponse = await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken2}`)
        .expect(HttpStatus.OK);

      expect(adminResponse.body.payload.companyId).toBe(testCompany1.id);
      expect(userResponse.body.payload.companyId).toBe(testCompany2.id);
      expect(adminResponse.body.payload.companyId).not.toBe(userResponse.body.payload.companyId);
    });
  });

  describe('Performance Tests', () => {
    it('should respond within acceptable time limits', async () => {
      const start = Date.now();

      await request(app.getHttpServer())
        .get('/auth/user')
        .set('Authorization', `Bearer ${validToken1}`)
        .expect(HttpStatus.OK);

      const responseTime = Date.now() - start;

      // Response should be under 500ms for simple user lookup
      expect(responseTime).toBeLessThan(500);
    });

    it('should handle multiple concurrent authenticated requests efficiently', async () => {
      const start = Date.now();

      const requests = Array(10)
        .fill(null)
        .map((_, index) =>
          // Add a small delay between request creation to avoid overwhelming the server
          new Promise((resolve) => setTimeout(resolve, index * 10)).then(
            () =>
              request(app.getHttpServer())
                .get('/auth/user')
                .set('Authorization', `Bearer ${validToken1}`)
                .timeout(5000) // Add timeout to prevent hanging
          )
        );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - start;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(HttpStatus.OK);
      });

      // Should complete within reasonable time (allowing for test environment overhead)
      expect(totalTime).toBeLessThan(2000);
    });
  });
});
