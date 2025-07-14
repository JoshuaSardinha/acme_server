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
import { ClientVersionGuard } from '../../src/core/guards/client-version.guard';
import { JwtAuthGuard } from '../../src/core/guards/jwt-auth.guard';
import { PermissionsGuard, REQUIRE_PERMISSIONS_KEY } from '../../src/core/guards/permissions.guard';
import { AuthService } from '../../src/modules/auth/auth.service';
import { User } from '../../src/modules/auth/entities/user.entity';
import { UserService } from '../../src/modules/auth/user.service';
import { Company, CompanyType } from '../../src/modules/company/entities/company.entity';
import { Role } from '../../src/modules/role/entities/role.entity';
import { authHelper } from '../auth/auth.helper';
import { MockJwtAuthGuard } from '../auth/mock-jwt-auth.guard';
import { ensureAcmeCompanyExists } from '../factories/acme-company.factory';
import { createTestCompany } from '../factories/company.factory';
import { createStandardRoles, getRoleByCode } from '../factories/role.factory';
import { DbCleanerService } from '../utils/db-cleaner.service';

@Injectable()
class InvitationsTestPermissionsGuard implements CanActivate {
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

    // Load user with role relation to check role code
    const fullUser = await User.findByPk(user.id, {
      include: [Role],
    });

    if (!fullUser || !fullUser.role) {
      throw new ForbiddenException({
        success: false,
        code: 'PERMISSION_DENIED',
        message: 'User role not found',
      });
    }

    const roleCode = fullUser.role.code;

    // Get required permissions from metadata
    const requiredPermissions = this.reflector.getAllAndMerge<string[]>(REQUIRE_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // For invitation permissions, check user role and permissions
    const hasAcInvitePermission = requiredPermissions.includes('users:invite:ac');
    const hasVendorInvitePermission = requiredPermissions.includes('users:invite:vendor');

    if (hasAcInvitePermission) {
      // Only ACME_ADMIN can invite Acme users
      if (roleCode === 'acme_admin') {
        return true;
      } else {
        throw new ForbiddenException({
          success: false,
          code: 'PERMISSION_DENIED',
          message: 'Insufficient permissions for AC user invitation',
        });
      }
    }

    if (hasVendorInvitePermission) {
      // Only VENDOR_ADMIN can invite vendor users
      if (roleCode === 'vendor_admin') {
        return true;
      } else {
        throw new ForbiddenException({
          success: false,
          code: 'PERMISSION_DENIED',
          message: 'Insufficient permissions for vendor user invitation',
        });
      }
    }

    // For other permissions, allow admin users
    const isAdmin = ['vendor_admin', 'acme_admin'].includes(roleCode);

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

describe('User Invitation Endpoints (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let dbCleaner: DbCleanerService;
  let authService: AuthService;
  let userService: UserService;

  // Test user tokens
  let acmeAdminToken: string;
  let vendorAdminToken: string;
  let vendorEmployeeToken: string;
  let clientToken: string;

  // Test companies
  let acmeCompany: Company;
  let vendorCompany: Company;

  // Test users
  let acmeAdmin: User;
  let vendorAdmin: User;
  let vendorEmployee: User;
  let client: User;

  // Mock Auth0 service methods
  const mockAuth0CreateUser = jest.fn();
  const mockAuth0SendEmail = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .overrideGuard(PermissionsGuard)
      .useClass(InvitationsTestPermissionsGuard)
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
    authService = moduleFixture.get<AuthService>(AuthService);
    userService = moduleFixture.get<UserService>(UserService);

    // Mock Auth0 methods
    jest.spyOn(authService, 'createAuth0User').mockImplementation(mockAuth0CreateUser);
    jest.spyOn(authService, 'sendPasswordResetEmail').mockImplementation(mockAuth0SendEmail);
  });

  afterAll(async () => {
    await dbCleaner.cleanAll();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await dbCleaner.cleanAll();

    // Create standard roles first
    await createStandardRoles();

    // Reset mocks before each test
    mockAuth0CreateUser.mockClear();
    mockAuth0SendEmail.mockClear();

    // Set default successful responses
    mockAuth0CreateUser.mockResolvedValue({ user_id: 'auth0|test123' });
    mockAuth0SendEmail.mockResolvedValue(undefined);

    // Ensure Acme company exists
    acmeCompany = await ensureAcmeCompanyExists();

    vendorCompany = await createTestCompany({
      name: 'Test Vendor Corp',
      subdomain: 'test-vendor-corp',
      subscription_type: 'premium',
      subscription_status: 'active',
    });
    // Update to correct type after creation
    await vendorCompany.update({ type: CompanyType.VENDOR });

    // Get roles for user creation
    const acmeAdminRole = await getRoleByCode('acme_admin');
    const vendorAdminRole = await getRoleByCode('vendor_admin');
    const vendorEmployeeRole = await getRoleByCode('vendor_employee');
    const clientRole = await getRoleByCode('client');

    if (!acmeAdminRole || !vendorAdminRole || !vendorEmployeeRole || !clientRole) {
      throw new Error('Required roles not found');
    }

    // Create test users using role_id instead of role enum
    acmeAdmin = await User.create({
      first_name: 'AC',
      last_name: 'Admin',
      email: 'acmeadmin@acme.com',
      auth0_user_id: 'auth0|acmeadmin',
      role_id: acmeAdminRole.id,
      company_id: acmeCompany.id,
      is_lawyer: false,
    });

    vendorAdmin = await User.create({
      first_name: 'Vendor',
      last_name: 'Admin',
      email: 'vendoradmin@vendor.com',
      auth0_user_id: 'auth0|vendoradmin',
      role_id: vendorAdminRole.id,
      company_id: vendorCompany.id,
      is_lawyer: false,
    });

    vendorEmployee = await User.create({
      first_name: 'Vendor',
      last_name: 'Employee',
      email: 'vendoremployee@vendor.com',
      auth0_user_id: 'auth0|vendoremployee',
      role_id: vendorEmployeeRole.id,
      company_id: vendorCompany.id,
      is_lawyer: true,
    });

    client = await User.create({
      first_name: 'Test',
      last_name: 'Client',
      email: 'client@example.com',
      auth0_user_id: 'auth0|client',
      role_id: clientRole.id,
      company_id: vendorCompany.id,
      is_lawyer: false,
    });

    // Generate JWT tokens using authHelper with role codes
    acmeAdminToken = authHelper.generateToken({
      sub: acmeAdmin.auth0_user_id,
      email: acmeAdmin.email,
      role: 'acme_admin',
      org_id: acmeAdmin.company_id,
      permissions: ['users:invite:ac'],
    });

    vendorAdminToken = authHelper.generateToken({
      sub: vendorAdmin.auth0_user_id,
      email: vendorAdmin.email,
      role: 'vendor_admin',
      org_id: vendorAdmin.company_id,
      permissions: ['users:invite:vendor'],
    });

    vendorEmployeeToken = authHelper.generateToken({
      sub: vendorEmployee.auth0_user_id,
      email: vendorEmployee.email,
      role: 'vendor_employee',
      org_id: vendorEmployee.company_id,
      permissions: [],
    });

    clientToken = authHelper.generateToken({
      sub: client.auth0_user_id,
      email: client.email,
      role: 'client',
      org_id: client.company_id,
      permissions: [],
    });
  });

  describe('POST /users/ac-invite', () => {
    const validAcInviteData = {
      email: 'newuser@acme.com',
      first_name: 'New',
      last_name: 'User',
      role: 'acme_employee',
      is_lawyer: false,
    };

    it('should successfully invite a new AC user when called by AC_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send(validAcInviteData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.code).toBe('INVITATION_201');
      expect(response.body.data.email).toBe('newuser@acme.com');
      expect(response.body.data.role).toBe('acme_employee');
      expect(response.body.data.status).toBe('PENDING');

      // Verify Auth0 calls were made
      expect(mockAuth0CreateUser).toHaveBeenCalledWith({
        email: 'newuser@acme.com',
        name: 'New User',
        user_metadata: expect.objectContaining({
          role: 'acme_employee',
        }),
      });
      expect(mockAuth0SendEmail).toHaveBeenCalledWith('newuser@acme.com');

      // Verify user was created in database
      const user = await User.findOne({ where: { email: 'newuser@acme.com' } });
      expect(user).toBeDefined();
      expect(user?.company_id).toBe(acmeCompany.id);
      expect(user?.auth0_user_id).toBe('auth0|test123');
    });

    it('should return 403 when vendor admin tries to use AC invite endpoint', () => {
      return request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', `Bearer ${vendorAdminToken}`)
        .send(validAcInviteData)
        .expect(403);
    });

    it('should return 403 when vendor employee tries to use AC invite endpoint', () => {
      return request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', `Bearer ${vendorEmployeeToken}`)
        .send(validAcInviteData)
        .expect(403);
    });

    it('should return 403 when client tries to use AC invite endpoint', () => {
      return request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(validAcInviteData)
        .expect(403);
    });

    it('should return 400 when trying to assign a vendor role via AC endpoint', () => {
      return request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({
          ...validAcInviteData,
          role: 'vendor_employee', // Invalid role for AC
        })
        .expect(400);
    });

    it('should return 409 when inviting an existing user', async () => {
      // First invitation
      await request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({
          email: 'duplicate@example.com',
          first_name: 'Dup',
          last_name: 'User',
          role: 'acme_employee',
          is_lawyer: false,
        })
        .expect(201);

      // Second invitation with same email
      return request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({
          email: 'duplicate@example.com',
          first_name: 'Dup',
          last_name: 'User',
          role: 'acme_employee',
          is_lawyer: false,
        })
        .expect(409);
    });

    it('should return 400 for invalid email format', () => {
      return request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({
          ...validAcInviteData,
          email: 'invalid-email',
        })
        .expect(400);
    });

    it('should return 400 for missing required fields', () => {
      return request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({
          email: 'test@example.com',
          // Missing first_name, last_name, role, is_lawyer
        })
        .expect(400);
    });

    it('should return 422 when Auth0 creation fails and rollback transaction', async () => {
      // Mock Auth0 to fail
      mockAuth0CreateUser.mockRejectedValueOnce(new Error('Auth0 API Error'));

      await request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({
          email: 'transactiontest@example.com',
          first_name: 'Transaction',
          last_name: 'Test',
          role: 'acme_employee',
          is_lawyer: false,
        })
        .expect(422);

      // Verify no user exists in database (transaction was rolled back)
      const user = await User.findOne({
        where: { email: 'transactiontest@example.com' },
      });
      expect(user).toBeNull();
    });
  });

  describe('POST /users/vendor-invite', () => {
    const validVendorInviteData = {
      email: 'newvendoruser@vendor.com',
      first_name: 'Vendor',
      last_name: 'Employee',
      role: 'vendor_employee',
      is_lawyer: true,
    };

    it('should successfully invite a new vendor user when called by VENDOR_ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/vendor-invite')
        .set('Authorization', `Bearer ${vendorAdminToken}`)
        .send(validVendorInviteData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.code).toBe('INVITATION_201');
      expect(response.body.data.email).toBe('newvendoruser@vendor.com');
      expect(response.body.data.role).toBe('vendor_employee');
      expect(response.body.data.company_id).toBe(vendorCompany.id);
      expect(response.body.data.status).toBe('PENDING');

      // Verify Auth0 calls were made
      expect(mockAuth0CreateUser).toHaveBeenCalledWith({
        email: 'newvendoruser@vendor.com',
        name: 'Vendor Employee',
        user_metadata: expect.objectContaining({
          companyId: vendorCompany.id,
          role: 'vendor_employee',
        }),
      });

      // Verify user was created in database with correct company
      const user = await User.findOne({ where: { email: 'newvendoruser@vendor.com' } });
      expect(user).toBeDefined();
      expect(user?.company_id).toBe(vendorCompany.id); // CRITICAL: Must be vendor's company
    });

    it('should return 403 when vendor employee tries to invite', () => {
      return request(app.getHttpServer())
        .post('/users/vendor-invite')
        .set('Authorization', `Bearer ${vendorEmployeeToken}`)
        .send(validVendorInviteData)
        .expect(403);
    });

    it('should return 403 when client tries to invite', () => {
      return request(app.getHttpServer())
        .post('/users/vendor-invite')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(validVendorInviteData)
        .expect(403);
    });

    it('should return 403 when AC admin tries to use vendor invite endpoint', () => {
      return request(app.getHttpServer())
        .post('/users/vendor-invite')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send(validVendorInviteData)
        .expect(403);
    });

    it('should return 400 when trying to assign an AC role via vendor endpoint', () => {
      return request(app.getHttpServer())
        .post('/users/vendor-invite')
        .set('Authorization', `Bearer ${vendorAdminToken}`)
        .send({
          ...validVendorInviteData,
          role: 'acme_employee', // Invalid role for vendor
        })
        .expect(400);
    });

    it('should ignore company_id in request body and use inviter company', async () => {
      // Create another company to test security
      const otherCompany = await createTestCompany({
        name: 'Other Company',
        subdomain: 'other-company',
        subscription_type: 'basic',
        subscription_status: 'active',
      });
      await otherCompany.update({ type: CompanyType.VENDOR });

      const response = await request(app.getHttpServer())
        .post('/users/vendor-invite')
        .set('Authorization', `Bearer ${vendorAdminToken}`)
        .send({
          ...validVendorInviteData,
          email: 'companytest@example.com',
          company_id: otherCompany.id, // Should be ignored
        })
        .expect(201);

      // Verify the created user has vendor admin's company, not the one in request
      const user = await User.findOne({ where: { email: 'companytest@example.com' } });
      expect(user?.company_id).toBe(vendorCompany.id); // Should be vendor admin's company
      expect(user?.company_id).not.toBe(otherCompany.id); // Should NOT be the company from request

      // Clean up is handled by dbCleaner.cleanAll() in beforeEach
    });

    it('should return 409 when inviting an existing user', async () => {
      // First invitation
      await request(app.getHttpServer())
        .post('/users/vendor-invite')
        .set('Authorization', `Bearer ${vendorAdminToken}`)
        .send({
          email: 'duplicate@example.com',
          first_name: 'Dup',
          last_name: 'User',
          role: 'vendor_employee',
          is_lawyer: false,
        })
        .expect(201);

      // Second invitation with same email
      return request(app.getHttpServer())
        .post('/users/vendor-invite')
        .set('Authorization', `Bearer ${vendorAdminToken}`)
        .send({
          email: 'duplicate@example.com',
          first_name: 'Dup',
          last_name: 'User',
          role: 'vendor_employee',
          is_lawyer: false,
        })
        .expect(409);
    });

    it('should return 422 when Auth0 creation fails and rollback transaction', async () => {
      // Mock Auth0 to fail
      mockAuth0CreateUser.mockRejectedValueOnce(new Error('Auth0 API Error'));

      await request(app.getHttpServer())
        .post('/users/vendor-invite')
        .set('Authorization', `Bearer ${vendorAdminToken}`)
        .send({
          email: 'fail.user@vendor.com',
          first_name: 'Fail',
          last_name: 'User',
          role: 'vendor_employee',
          is_lawyer: false,
        })
        .expect(422);

      // Verify no user exists in database (transaction was rolled back)
      const user = await User.findOne({
        where: { email: 'fail.user@vendor.com' },
      });
      expect(user).toBeNull();
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when no JWT token is provided', () => {
      return request(app.getHttpServer())
        .post('/users/ac-invite')
        .send({
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          role: 'acme_employee',
          is_lawyer: false,
        })
        .expect(401);
    });

    it('should return 401 when invalid JWT token is provided', () => {
      return request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          role: 'acme_employee',
          is_lawyer: false,
        })
        .expect(401);
    });
  });

  describe('Input Validation', () => {
    it('should return 400 for invalid boolean value', () => {
      return request(app.getHttpServer())
        .post('/users/ac-invite')
        .set('Authorization', `Bearer ${acmeAdminToken}`)
        .send({
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          role: 'acme_employee',
          is_lawyer: 'not-a-boolean',
        })
        .expect(400);
    });

    it('should return 400 for empty required fields', () => {
      return request(app.getHttpServer())
        .post('/users/vendor-invite')
        .set('Authorization', `Bearer ${vendorAdminToken}`)
        .send({
          email: '',
          first_name: '',
          last_name: '',
          role: 'vendor_employee',
          is_lawyer: true,
        })
        .expect(400);
    });
  });
});
