import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { CompanyAdminGuard } from '../../src/core/guards/company-admin.guard';
import { JwtAuthGuard } from '../../src/core/guards/jwt-auth.guard';
import { PermissionsGuard, REQUIRE_PERMISSIONS_KEY } from '../../src/core/guards/permissions.guard';
import { User, UserRole } from '../../src/modules/auth/entities/user.entity';
import {
  Company,
  CompanyStatus,
  CompanyType,
} from '../../src/modules/company/entities/company.entity';
import { Role } from '../../src/modules/role/entities/role.entity';
import { authHelper } from '../auth/auth.helper';
import { MockJwtAuthGuard } from '../auth/mock-jwt-auth.guard';
import { createTestCompany } from '../factories/company.factory';
import { ensureAcmeCompanyExists, getAcmeCompanyId } from '../factories/acme-company.factory';
import { createStandardRoles, getRoleByCode } from '../factories/role.factory';
import { createTestUser, createTestVendorAdmin } from '../factories/user.factory';
import { DbCleanerService } from '../utils/db-cleaner.service';

@Injectable()
class CompaniesTestPermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user is set by JwtAuthGuard, deny access
    if (!user) {
      throw new ForbiddenException({
        success: false,
        code: 'PERMISSION_DENIED',
        message: 'User not authenticated',
      });
    }

    // Get required permissions from metadata
    const requiredPermissions = this.reflector.getAllAndMerge<string[]>(REQUIRE_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Company admin permissions are only for NATIONAL_NINER_ADMIN
    const companyAdminPermissions = ['MANAGE_COMPANIES', 'APPROVE_COMPANIES', 'CREATE_COMPANIES'];

    const requiresCompanyAdminPermission = requiredPermissions.some((perm) =>
      companyAdminPermissions.includes(perm)
    );

    if (requiresCompanyAdminPermission) {
      // Only NATIONAL_NINER_ADMIN can access company admin endpoints
      // Need to load the user with role relation
      const userWithRole = await User.findByPk(user.id, {
        include: [{ model: Role, as: 'role' }],
      });

      const roleCode = userWithRole?.role?.code || '';
      const roleName = userWithRole?.role?.name || '';

      if (roleCode === 'acme_admin' || roleName === 'Acme Admin') {
        return true;
      } else {
        throw new ForbiddenException({
          success: false,
          code: 'PERMISSION_DENIED',
          message: 'Insufficient permissions for company administration',
        });
      }
    }

    // For other permissions, allow admin users
    const userWithRole = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'role' }],
    });

    const adminRoleCodes = ['vendor_admin', 'national_niner_admin'];
    const adminRoleNames = ['Vendor Admin', 'Acme Admin'];
    const roleCode = userWithRole?.role?.code || '';
    const roleName = userWithRole?.role?.name || '';
    const isAdmin =
      userWithRole?.role &&
      (adminRoleCodes.includes(roleCode) || adminRoleNames.includes(roleName));

    if (isAdmin) {
      return true;
    }

    // For non-admin users, deny access
    throw new ForbiddenException({
      success: false,
      code: 'PERMISSION_DENIED',
      message: 'Insufficient permissions',
    });
  }
}

@Injectable()
class CompaniesTestCompanyAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user is admin
    const userWithRole = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'role' }],
    });

    const adminRoleCodes = ['vendor_admin', 'national_niner_admin'];
    const adminRoleNames = ['Vendor Admin', 'Acme Admin'];
    const roleCode = userWithRole?.role?.code || '';
    const roleName = userWithRole?.role?.name || '';
    const isAdmin =
      userWithRole?.role &&
      (adminRoleCodes.includes(roleCode) || adminRoleNames.includes(roleName));
    if (!isAdmin) {
      throw new ForbiddenException('User is not an admin');
    }

    // For endpoints with companyId parameter, validate access to that specific company
    const { companyId } = request.params;
    if (companyId && user.company_id) {
      // Check if user belongs to the company
      if (user.company_id !== companyId) {
        throw new ForbiddenException('User not authorized to access this company');
      }
    }

    return true;
  }
}

describe('Companies E2E', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let dbCleaner: DbCleanerService;

  // Test data
  let acmeAdminUser: User;
  let vendorAdminUser: User;
  let clientUser: User;
  let pendingCompany: Company;
  let activeCompany: Company;
  let suspendedCompany: Company;
  let acmeCompany: Company;

  // JWT tokens
  let nnAdminToken: string;
  let vendorAdminToken: string;
  let clientToken: string;
  let invalidToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .overrideGuard(PermissionsGuard)
      .useClass(CompaniesTestPermissionsGuard)
      .overrideGuard(CompanyAdminGuard)
      .useClass(CompaniesTestCompanyAdminGuard)
      .compile();

    app = moduleFixture.createNestApplication();
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

    // Create test companies first
    pendingCompany = await createTestCompany({
      name: 'Pending Legal Co',
      subdomain: 'pending-legal',
    });
    // Update status after creation since factory doesn't support all fields
    await pendingCompany.update({
      email: 'contact@pendinglegal.com',
      type: CompanyType.VENDOR,
      status: CompanyStatus.PENDING_APPROVAL,
    });

    activeCompany = await createTestCompany({
      name: 'Active Legal Co',
      subdomain: 'active-legal',
    });
    await activeCompany.update({
      email: 'contact@activelegal.com',
      type: CompanyType.VENDOR,
      status: CompanyStatus.ACTIVE,
    });

    suspendedCompany = await createTestCompany({
      name: 'Suspended Legal Co',
      subdomain: 'suspended-legal',
    });
    await suspendedCompany.update({
      email: 'contact@suspendedlegal.com',
      type: CompanyType.VENDOR,
      status: CompanyStatus.SUSPENDED,
    });

    // Create test users using factories
    // Acme Admin belongs to the Acme company
    const nnAdminRole = await getRoleByCode('national_niner_admin');
    if (!nnAdminRole) {
      throw new Error('Acme Admin role not found');
    }

    acmeAdminUser = await User.create({
      first_name: 'NN',
      last_name: 'Admin',
      email: 'nn.admin@nationalniner.com',
      auth0_user_id: 'auth0|nn-admin',
      role_id: nnAdminRole.id,
      company_id: getAcmeCompanyId(), // Acme admins belong to Acme company
    });

    vendorAdminUser = await createTestVendorAdmin(pendingCompany.id, {
      first_name: 'Vendor',
      last_name: 'Admin',
      email: 'admin@vendor.com',
      auth0_user_id: 'auth0|vendor-admin',
    });

    clientUser = await createTestUser(activeCompany.id, {
      first_name: 'Client',
      last_name: 'User',
      email: 'client@example.com',
      auth0_user_id: 'auth0|client',
      role: UserRole.CLIENT,
    });

    // Update company ownership after users are created
    await pendingCompany.update({
      owner_id: vendorAdminUser.id,
      primary_contact_user_id: vendorAdminUser.id,
    });

    // Generate JWT tokens using authHelper
    nnAdminToken = authHelper.generateToken({
      sub: acmeAdminUser.auth0_user_id,
      email: acmeAdminUser.email,
      role: 'national_niner_admin',
      org_id: acmeAdminUser.company_id, // Acme admins belong to Acme company
    });

    vendorAdminToken = authHelper.generateToken({
      sub: vendorAdminUser.auth0_user_id,
      email: vendorAdminUser.email,
      role: 'vendor_admin',
      org_id: vendorAdminUser.company_id,
    });

    clientToken = authHelper.generateToken({
      sub: clientUser.auth0_user_id,
      email: clientUser.email,
      role: 'client',
      org_id: clientUser.company_id,
    });

    invalidToken = authHelper.generateInvalidToken();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Public Vendor Registration (REQ-COMP-002)', () => {
    const validVendorRegistration = {
      companyName: 'Test Legal Services',
      companyEmail: 'contact@testlegal.com',
      subdomain: 'test-legal',
      adminFirstName: 'John',
      adminLastName: 'Doe',
      adminEmail: 'john@testlegal.com',
      auth0UserId: 'auth0|new-vendor-admin',
      address: '123 Legal St',
      phoneNumber: '+1-555-0123',
      isLawyer: true,
      subscriptionType: 'starter',
    };

    it('should successfully register a new vendor', async () => {
      const response = await request(app.getHttpServer())
        .post('/companies/register-vendor')
        .send(validVendorRegistration)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Vendor registration submitted successfully',
        company: {
          name: 'Test Legal Services',
          status: CompanyStatus.PENDING_APPROVAL,
          subdomain: 'test-legal',
        },
        user: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@testlegal.com',
        },
      });

      // Verify database records
      const company = await Company.findOne({ where: { name: 'Test Legal Services' } });
      expect(company).toBeTruthy();
      expect(company?.status).toBe(CompanyStatus.PENDING_APPROVAL);

      const user = await User.findOne({ where: { email: 'john@testlegal.com' } });
      expect(user).toBeTruthy();
      // Load user with role to check
      const userWithRole = await User.findByPk(user!.id, {
        include: [{ model: Role, as: 'role' }],
      });
      expect(userWithRole?.role?.code).toBe('vendor_admin');
      expect(user?.company_id).toBe(company?.id);
    });

    it('should return 409 for duplicate company name', async () => {
      await request(app.getHttpServer())
        .post('/companies/register-vendor')
        .send(validVendorRegistration)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/companies/register-vendor')
        .send({
          ...validVendorRegistration,
          subdomain: 'different-subdomain',
          companyEmail: 'different@email.com',
          adminEmail: 'different@admin.com',
        })
        .expect(409);

      expect(response.body.message).toContain('company with this name already exists');
    });

    it('should return 409 for duplicate subdomain', async () => {
      await request(app.getHttpServer())
        .post('/companies/register-vendor')
        .send(validVendorRegistration)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/companies/register-vendor')
        .send({
          ...validVendorRegistration,
          companyName: 'Different Company Name',
          companyEmail: 'different@email.com',
          adminEmail: 'different@admin.com',
        })
        .expect(409);

      expect(response.body.message).toContain('subdomain is already taken');
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/companies/register-vendor')
        .send({
          companyName: '',
          adminEmail: 'invalid-email',
        })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Company name must be between 2 and 100 characters'),
          expect.stringContaining('Please provide a valid company email address'),
          expect.stringContaining('Please provide a valid admin email address'),
        ])
      );
    });

    it('should validate subdomain format', async () => {
      const response = await request(app.getHttpServer())
        .post('/companies/register-vendor')
        .send({
          ...validVendorRegistration,
          subdomain: 'Invalid_Subdomain!',
        })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'Subdomain must contain only lowercase letters, numbers, and hyphens'
          ),
        ])
      );
    });

    it('should handle transactional rollback on user creation failure', async () => {
      // Mock a failure during user creation by using an invalid auth0_user_id
      const response = await request(app.getHttpServer())
        .post('/companies/register-vendor')
        .send({
          ...validVendorRegistration,
          auth0UserId: null, // This will cause validation to fail
        })
        .expect(400);

      // Verify no company was created
      const company = await Company.findOne({ where: { name: 'Test Legal Services' } });
      expect(company).toBeNull();

      // Verify no user was created
      const user = await User.findOne({ where: { email: 'john@testlegal.com' } });
      expect(user).toBeNull();
    });
  });

  describe('Admin Company Management (REQ-COMP-003)', () => {
    describe('GET /admin/companies - List Companies', () => {
      it('should list companies for NN_ADMIN', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/companies')
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          companies: expect.arrayContaining([
            expect.objectContaining({ name: 'Pending Legal Co' }),
            expect.objectContaining({ name: 'Active Legal Co' }),
            expect.objectContaining({ name: 'Suspended Legal Co' }),
            expect.objectContaining({ name: 'Acme' }),
          ]),
          totalCount: 4,
          currentPage: 1,
        });
      });

      it('should filter companies by status', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/companies?status=PENDING_APPROVAL')
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .expect(200);

        expect(response.body.companies).toHaveLength(1);
        expect(response.body.companies[0].status).toBe(CompanyStatus.PENDING_APPROVAL);
      });

      it('should paginate results', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/companies?page=1&limit=2')
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .expect(200);

        expect(response.body.companies).toHaveLength(2);
        expect(response.body.totalPages).toBe(2);
      });

      it('should search companies by name', async () => {
        const response = await request(app.getHttpServer())
          .get('/admin/companies?searchTerm=Pending')
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .expect(200);

        expect(response.body.companies).toHaveLength(1);
        expect(response.body.companies[0].name).toContain('Pending');
      });
    });

    describe('PATCH /admin/companies/:companyId/approve - Approve Company', () => {
      it('should approve a pending company', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/admin/companies/${pendingCompany.id}/approve`)
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .send({ reason: 'All requirements met' })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Company approved successfully',
          company: {
            id: pendingCompany.id,
            status: CompanyStatus.ACTIVE,
          },
        });

        // Verify database update
        const updatedCompany = await Company.findByPk(pendingCompany.id);
        expect(updatedCompany?.status).toBe(CompanyStatus.ACTIVE);
      });

      it('should reject approval of non-pending company', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/admin/companies/${activeCompany.id}/approve`)
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .expect(422);

        expect(response.body.message).toContain('Cannot approve company with status ACTIVE');
      });
    });

    describe('PATCH /admin/companies/:companyId/reject - Reject Company', () => {
      it('should reject a pending company with reason', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/admin/companies/${pendingCompany.id}/reject`)
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .send({ reason: 'Incomplete documentation' })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Company rejected successfully',
          company: {
            id: pendingCompany.id,
            status: CompanyStatus.REJECTED,
          },
        });

        // Verify database update
        const updatedCompany = await Company.findByPk(pendingCompany.id);
        expect(updatedCompany?.status).toBe(CompanyStatus.REJECTED);
      });

      it('should require rejection reason', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/admin/companies/${pendingCompany.id}/reject`)
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .send({})
          .expect(400);

        expect(response.body.message).toContain('Rejection reason is required');
      });
    });

    describe('PATCH /admin/companies/:companyId/status - Update Status', () => {
      it('should suspend an active company', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/admin/companies/${activeCompany.id}/status`)
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .send({
            status: CompanyStatus.SUSPENDED,
            reason: 'Terms of service violation',
          })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Company status updated successfully',
          company: {
            id: activeCompany.id,
            status: CompanyStatus.SUSPENDED,
          },
        });
      });

      it('should reactivate a suspended company', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/admin/companies/${suspendedCompany.id}/status`)
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .send({
            status: CompanyStatus.ACTIVE,
            reason: 'Issues resolved',
          })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Company status updated successfully',
          company: {
            id: suspendedCompany.id,
            status: CompanyStatus.ACTIVE,
          },
        });
      });
    });

    describe('POST /admin/companies/vendor - Admin Create Vendor', () => {
      it('should create vendor company directly', async () => {
        const vendorData = {
          companyName: 'Admin Created Legal',
          companyEmail: 'contact@admincreated.com',
          subdomain: 'admin-created',
          adminFirstName: 'Admin',
          adminLastName: 'Created',
          adminEmail: 'admin@admincreated.com',
          auth0UserId: 'auth0|admin-created',
          autoApprove: true,
        };

        const response = await request(app.getHttpServer())
          .post('/admin/companies/vendor')
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .send(vendorData)
          .expect(201);

        expect(response.body).toMatchObject({
          message: 'Vendor company created successfully',
          company: {
            name: 'Admin Created Legal',
            subdomain: 'admin-created',
          },
        });
      });
    });
  });

  describe('Authorization Tests', () => {
    it('should deny VENDOR_ADMIN access to admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/admin/companies')
        .set('Authorization', `Bearer ${vendorAdminToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/admin/companies/${pendingCompany.id}/approve`)
        .set('Authorization', `Bearer ${vendorAdminToken}`)
        .expect(403);
    });

    it('should deny CLIENT access to admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/admin/companies')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/admin/companies/${pendingCompany.id}/approve`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);
    });

    it('should deny unauthenticated access to admin endpoints', async () => {
      await request(app.getHttpServer()).get('/admin/companies').expect(401);

      await request(app.getHttpServer())
        .patch(`/admin/companies/${pendingCompany.id}/approve`)
        .expect(401);
    });

    it('should deny access with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/admin/companies')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should allow public access to vendor registration', async () => {
      const validRegistration = {
        companyName: 'Public Test Legal',
        companyEmail: 'contact@publictest.com',
        subdomain: 'public-test',
        adminFirstName: 'Public',
        adminLastName: 'User',
        adminEmail: 'public@publictest.com',
        auth0UserId: 'auth0|public-user',
      };

      await request(app.getHttpServer())
        .post('/companies/register-vendor')
        .send(validRegistration)
        .expect(201);
    });
  });

  describe('Multi-tenant Data Isolation', () => {
    it('should not allow vendor admin to see other companies', async () => {
      // Create a vendor admin with a specific company
      const vendorCompany = await Company.create({
        name: 'Vendor Only Company',
        email: 'vendor@only.com',
        type: CompanyType.VENDOR,
        status: CompanyStatus.ACTIVE,
        subdomain: 'vendor-only',
        owner_id: vendorAdminUser.id,
      });

      await vendorAdminUser.update({ company_id: vendorCompany.id });

      const vendorToken = authHelper.generateToken({
        sub: vendorAdminUser.auth0_user_id,
        email: vendorAdminUser.email,
        role: 'vendor_admin',
        org_id: vendorCompany.id,
      });

      // Vendor admin should not be able to access other companies
      await request(app.getHttpServer())
        .get(`/companies/${activeCompany.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(403);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent status updates gracefully', async () => {
      const promises = [
        request(app.getHttpServer())
          .patch(`/admin/companies/${pendingCompany.id}/approve`)
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .send({ reason: 'First approval attempt' }),

        request(app.getHttpServer())
          .patch(`/admin/companies/${pendingCompany.id}/approve`)
          .set('Authorization', `Bearer ${nnAdminToken}`)
          .send({ reason: 'Second approval attempt' }),
      ];

      const results = await Promise.allSettled(promises);

      // One should succeed, one should fail
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200
      ).length;
      const failureCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 422
      ).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });
  });

  describe('Database Consistency', () => {
    it('should maintain data integrity during failed transactions', async () => {
      const beforeCompanyCount = await Company.count();
      const beforeUserCount = await User.count();

      // Attempt registration with invalid data that should cause rollback
      await request(app.getHttpServer())
        .post('/companies/register-vendor')
        .send({
          companyName: 'Transaction Test',
          // Missing required fields to cause failure
        })
        .expect(400);

      const afterCompanyCount = await Company.count();
      const afterUserCount = await User.count();

      // Counts should remain the same
      expect(afterCompanyCount).toBe(beforeCompanyCount);
      expect(afterUserCount).toBe(beforeUserCount);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in company names', async () => {
      const specialCharRegistration = {
        companyName: 'Test & Associates, LLC (Special Chars!)',
        companyEmail: 'contact@special.com',
        subdomain: 'special-chars',
        adminFirstName: 'Special',
        adminLastName: 'User',
        adminEmail: 'special@special.com',
        auth0UserId: 'auth0|special-user',
      };

      await request(app.getHttpServer())
        .post('/companies/register-vendor')
        .send(specialCharRegistration)
        .expect(201);
    });

    it('should handle large dataset pagination performance', async () => {
      // This test would be more meaningful with a larger dataset
      const response = await request(app.getHttpServer())
        .get('/admin/companies?page=1&limit=100')
        .set('Authorization', `Bearer ${nnAdminToken}`)
        .expect(200);

      expect(response.body.companies.length).toBeLessThanOrEqual(100);
    });

    it('should handle non-existent company ID gracefully', async () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999';

      await request(app.getHttpServer())
        .patch(`/admin/companies/${nonExistentId}/approve`)
        .set('Authorization', `Bearer ${nnAdminToken}`)
        .expect(404);
    });
  });
});
