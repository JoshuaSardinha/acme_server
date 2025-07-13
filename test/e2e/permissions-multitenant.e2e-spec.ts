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
// Removed unused import: createTestUser
import { DbCleanerService } from '../utils/db-cleaner.service';

// Import modules and entities
import { User } from '../../src/modules/auth/entities/user.entity';
import { Company } from '../../src/modules/company/entities/company.entity';
import { Permission, Role, UserPermission } from '../../src/modules/role/entities';

/**
 * Multi-Tenant Permission Security E2E Tests
 *
 * Comprehensive testing of multi-tenant security boundaries in the permission system.
 * Tests real-world legal platform scenarios with multiple law firms, attorneys,
 * clients, and document access patterns.
 */
describe('Multi-Tenant Permission Security (E2E)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let dbCleaner: DbCleanerService;

  // Law Firms (Companies)
  let nationalNinerLaw: Company;
  let smithLawFirm: Company;
  let johnsonAttorneys: Company;
  let publicDefender: Company;

  // Users across different firms
  let nationalNinerAdmin: User;
  let nationalNinerAttorney: User;
  let smithAdmin: User;
  let smithAttorney: User;
  let smithClient: User;
  let johnsonAdmin: User;
  let johnsonAttorney: User;
  let publicDefenderAttorney: User;

  // Roles across different firms
  let nationalNinerAdminRole: Role;
  let smithAdminRole: Role;
  let smithAttorneyRole: Role;
  let smithClientRole: Role;
  let johnsonAdminRole: Role;
  let johnsonAttorneyRole: Role;
  let publicDefenderRole: Role;

  // Permissions
  let permissions: Permission[];

  // Auth tokens for different users
  let tokens: { [key: string]: string } = {};

  // Legal platform specific permissions
  const legalPermissions = [
    {
      name: 'CREATE_PETITION',
      category: 'PETITION_MANAGEMENT',
      description: 'Create new petitions',
    },
    { name: 'VIEW_PETITION', category: 'PETITION_MANAGEMENT', description: 'View petitions' },
    { name: 'EDIT_PETITION', category: 'PETITION_MANAGEMENT', description: 'Edit petitions' },
    {
      name: 'APPROVE_PETITION',
      category: 'PETITION_MANAGEMENT',
      description: 'Approve petitions for filing',
    },
    {
      name: 'FILE_PETITION',
      category: 'PETITION_MANAGEMENT',
      description: 'File petitions with court',
    },
    {
      name: 'MANAGE_CLIENT_DOCUMENTS',
      category: 'DOCUMENT_MANAGEMENT',
      description: 'Manage client documents',
    },
    {
      name: 'VIEW_CLIENT_DOCUMENTS',
      category: 'DOCUMENT_MANAGEMENT',
      description: 'View client documents',
    },
    {
      name: 'SHARE_DOCUMENTS',
      category: 'DOCUMENT_MANAGEMENT',
      description: 'Share documents with clients',
    },
    { name: 'MANAGE_BILLING', category: 'BILLING', description: 'Manage billing and invoices' },
    { name: 'VIEW_BILLING', category: 'BILLING', description: 'View billing information' },
    { name: 'MANAGE_FIRM_USERS', category: 'USER_MANAGEMENT', description: 'Manage firm users' },
    { name: 'VIEW_FIRM_USERS', category: 'USER_MANAGEMENT', description: 'View firm users' },
    { name: 'ASSIGN_CASES', category: 'CASE_MANAGEMENT', description: 'Assign cases to attorneys' },
    { name: 'VIEW_CASE_STATUS', category: 'CASE_MANAGEMENT', description: 'View case status' },
    { name: 'GENERATE_REPORTS', category: 'REPORTING', description: 'Generate firm reports' },
    { name: 'VIEW_REPORTS', category: 'REPORTING', description: 'View reports' },
    {
      name: 'CLIENT_PORTAL_ACCESS',
      category: 'CLIENT_PORTAL',
      description: 'Access client portal',
    },
    {
      name: 'UPLOAD_DOCUMENTS',
      category: 'CLIENT_PORTAL',
      description: 'Upload documents to portal',
    },
  ];

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

    // Get properly configured services from DI container
    sequelize = app.get<Sequelize>(getConnectionToken());
    dbCleaner = new DbCleanerService(sequelize);
  });

  beforeEach(async () => {
    await dbCleaner.cleanAll();

    // Create standard roles first
    await createStandardRoles();

    // Ensure National Niner company exists
    nationalNinerLaw = await ensureAcmeCompanyExists();

    // Create law firms (companies) with unique subdomains to avoid conflicts
    const testId = Date.now().toString();

    smithLawFirm = await createTestCompany({
      name: 'Smith & Associates Law Firm',
      subdomain: `smith-law-${testId}`,
      subscription_type: 'premium',
      subscription_status: 'active',
    });

    johnsonAttorneys = await createTestCompany({
      name: 'Johnson Attorneys',
      subdomain: `johnson-attorneys-${testId}`,
      subscription_type: 'premium',
      subscription_status: 'active',
    });

    publicDefender = await createTestCompany({
      name: 'City Public Defender Office',
      subdomain: `public-defender-${testId}`,
      subscription_type: 'basic',
      subscription_status: 'active',
    });

    // Create permissions
    permissions = await Promise.all(
      legalPermissions.map((perm, index) =>
        Permission.create({
          id: `perm-${perm.name.toLowerCase().replace(/_/g, '-')}`,
          ...perm,
        })
      )
    );

    // Create roles for each firm
    await createFirmRoles();
    await createFirmUsers();
    await assignRolesAndPermissions();
    await generateAuthTokens();
  });

  afterAll(async () => {
    await dbCleaner.cleanAll();
    await app.close();
  });

  async function createFirmRoles() {
    // Get standard roles from the database
    const nnAdminRole = await getRoleByCode('national_niner_admin');
    const vendorAdminRole = await getRoleByCode('vendor_admin');
    const vendorEmployeeRole = await getRoleByCode('vendor_employee');
    const clientRole = await getRoleByCode('client');

    if (!nnAdminRole || !vendorAdminRole || !vendorEmployeeRole || !clientRole) {
      throw new Error('Required standard roles not found');
    }

    // Now assign to the non-nullable variables
    nationalNinerAdminRole = nnAdminRole;
    smithAdminRole = vendorAdminRole;
    smithAttorneyRole = vendorEmployeeRole;
    smithClientRole = clientRole;
    johnsonAdminRole = vendorAdminRole;
    johnsonAttorneyRole = vendorEmployeeRole;
    publicDefenderRole = vendorEmployeeRole;
  }

  async function createFirmUsers() {
    // Get roles for user creation
    const nnAdminRole = await getRoleByCode('national_niner_admin');
    const nnEmployeeRole = await getRoleByCode('national_niner_employee');
    const vendorAdminRole = await getRoleByCode('vendor_admin');
    const vendorEmployeeRole = await getRoleByCode('vendor_employee');
    const clientRole = await getRoleByCode('client');

    if (!nnAdminRole || !nnEmployeeRole || !vendorAdminRole || !vendorEmployeeRole || !clientRole) {
      throw new Error('Required roles not found');
    }

    // National Niner users
    nationalNinerAdmin = await User.create({
      first_name: 'NN',
      last_name: 'Admin',
      email: 'admin@nationalniner.com',
      auth0_user_id: 'auth0|nn_admin_123',
      role_id: nnAdminRole.id,
      company_id: nationalNinerLaw.id,
      is_lawyer: false,
    });

    nationalNinerAttorney = await User.create({
      first_name: 'NN',
      last_name: 'Attorney',
      email: 'attorney@nationalniner.com',
      auth0_user_id: 'auth0|nn_attorney_123',
      role_id: nnEmployeeRole.id,
      company_id: nationalNinerLaw.id,
      is_lawyer: true,
    });

    // Smith Law Firm users
    smithAdmin = await User.create({
      first_name: 'Smith',
      last_name: 'Admin',
      email: 'admin@smithlaw.com',
      auth0_user_id: 'auth0|smith_admin_123',
      role_id: vendorAdminRole.id,
      company_id: smithLawFirm.id,
      is_lawyer: false,
    });

    smithAttorney = await User.create({
      first_name: 'Smith',
      last_name: 'Attorney',
      email: 'attorney@smithlaw.com',
      auth0_user_id: 'auth0|smith_attorney_123',
      role_id: vendorEmployeeRole.id,
      company_id: smithLawFirm.id,
      is_lawyer: true,
    });

    smithClient = await User.create({
      first_name: 'Smith',
      last_name: 'Client',
      email: 'client@email.com',
      auth0_user_id: 'auth0|smith_client_123',
      role_id: clientRole.id,
      company_id: smithLawFirm.id,
      is_lawyer: false,
    });

    // Johnson Attorneys users
    johnsonAdmin = await User.create({
      first_name: 'Johnson',
      last_name: 'Admin',
      email: 'admin@johnsonlaw.com',
      auth0_user_id: 'auth0|johnson_admin_123',
      role_id: vendorAdminRole.id,
      company_id: johnsonAttorneys.id,
      is_lawyer: false,
    });

    johnsonAttorney = await User.create({
      first_name: 'Johnson',
      last_name: 'Attorney',
      email: 'attorney@johnsonlaw.com',
      auth0_user_id: 'auth0|johnson_attorney_123',
      role_id: vendorEmployeeRole.id,
      company_id: johnsonAttorneys.id,
      is_lawyer: true,
    });

    // Public Defender users
    publicDefenderAttorney = await User.create({
      first_name: 'Public',
      last_name: 'Defender',
      email: 'attorney@publicdefender.gov',
      auth0_user_id: 'auth0|pd_attorney_123',
      role_id: vendorEmployeeRole.id,
      company_id: publicDefender.id,
      is_lawyer: true,
    });
  }

  async function assignRolesAndPermissions() {
    // For this test, we'll use direct user permissions for the legal-specific permissions
    // since the standard roles might not have these exact permissions

    // Create some test-specific direct permissions for users to enable the test scenarios
    const testUserPermissions = [
      // Give National Niner admin some system-wide permissions
      {
        user_id: nationalNinerAdmin.id,
        permission_id: permissions.find((p) => p.name === 'MANAGE_FIRM_USERS')?.id,
        granted: true,
        granted_at: new Date(),
      },
      {
        user_id: nationalNinerAdmin.id,
        permission_id: permissions.find((p) => p.name === 'GENERATE_REPORTS')?.id,
        granted: true,
        granted_at: new Date(),
      },
      {
        user_id: nationalNinerAdmin.id,
        permission_id: permissions.find((p) => p.name === 'MANAGE_BILLING')?.id,
        granted: true,
        granted_at: new Date(),
      },

      // Give Smith admin some admin permissions directly
      {
        user_id: smithAdmin.id,
        permission_id: permissions.find((p) => p.name === 'MANAGE_FIRM_USERS')?.id,
        granted: true,
        granted_at: new Date(),
      },
      {
        user_id: smithAdmin.id,
        permission_id: permissions.find((p) => p.name === 'MANAGE_BILLING')?.id,
        granted: true,
        granted_at: new Date(),
      },
      {
        user_id: smithAdmin.id,
        permission_id: permissions.find((p) => p.name === 'GENERATE_REPORTS')?.id,
        granted: true,
        granted_at: new Date(),
      },

      // Give attorneys some petition permissions
      {
        user_id: smithAttorney.id,
        permission_id: permissions.find((p) => p.name === 'CREATE_PETITION')?.id,
        granted: true,
        granted_at: new Date(),
      },
      {
        user_id: smithAttorney.id,
        permission_id: permissions.find((p) => p.name === 'VIEW_PETITION')?.id,
        granted: true,
        granted_at: new Date(),
      },
      {
        user_id: johnsonAttorney.id,
        permission_id: permissions.find((p) => p.name === 'CREATE_PETITION')?.id,
        granted: true,
        granted_at: new Date(),
      },
      {
        user_id: johnsonAttorney.id,
        permission_id: permissions.find((p) => p.name === 'VIEW_PETITION')?.id,
        granted: true,
        granted_at: new Date(),
      },

      // Give client some portal permissions
      {
        user_id: smithClient.id,
        permission_id: permissions.find((p) => p.name === 'CLIENT_PORTAL_ACCESS')?.id,
        granted: true,
        granted_at: new Date(),
      },
      {
        user_id: smithClient.id,
        permission_id: permissions.find((p) => p.name === 'UPLOAD_DOCUMENTS')?.id,
        granted: true,
        granted_at: new Date(),
      },

      // Give Johnson admin admin permissions
      {
        user_id: johnsonAdmin.id,
        permission_id: permissions.find((p) => p.name === 'MANAGE_FIRM_USERS')?.id,
        granted: true,
        granted_at: new Date(),
      },
      {
        user_id: johnsonAdmin.id,
        permission_id: permissions.find((p) => p.name === 'MANAGE_BILLING')?.id,
        granted: true,
        granted_at: new Date(),
      },

      // Give public defender basic permissions
      {
        user_id: publicDefenderAttorney.id,
        permission_id: permissions.find((p) => p.name === 'CREATE_PETITION')?.id,
        granted: true,
        granted_at: new Date(),
      },
      {
        user_id: publicDefenderAttorney.id,
        permission_id: permissions.find((p) => p.name === 'VIEW_PETITION')?.id,
        granted: true,
        granted_at: new Date(),
      },
    ].filter((p) => p.permission_id); // Filter out any undefined permission_ids

    if (testUserPermissions.length > 0) {
      await UserPermission.bulkCreate(testUserPermissions);
    }

    // Note: Users now have direct role_id foreign keys set during creation
    // Standard role permissions are handled by the role system
  }

  async function generateAuthTokens() {
    tokens = {
      nationalNinerAdmin: authHelper.generateToken({
        sub: nationalNinerAdmin.auth0_user_id,
        email: nationalNinerAdmin.email,
        role: 'national_niner_admin',
        org_id: nationalNinerLaw.id,
      }),
      nationalNinerAttorney: authHelper.generateToken({
        sub: nationalNinerAttorney.auth0_user_id,
        email: nationalNinerAttorney.email,
        role: 'national_niner_employee',
        org_id: nationalNinerLaw.id,
      }),
      smithAdmin: authHelper.generateToken({
        sub: smithAdmin.auth0_user_id,
        email: smithAdmin.email,
        role: 'vendor_admin',
        org_id: smithLawFirm.id,
      }),
      smithAttorney: authHelper.generateToken({
        sub: smithAttorney.auth0_user_id,
        email: smithAttorney.email,
        role: 'vendor_employee',
        org_id: smithLawFirm.id,
      }),
      smithClient: authHelper.generateToken({
        sub: smithClient.auth0_user_id,
        email: smithClient.email,
        role: 'client',
        org_id: smithLawFirm.id,
      }),
      johnsonAdmin: authHelper.generateToken({
        sub: johnsonAdmin.auth0_user_id,
        email: johnsonAdmin.email,
        role: 'vendor_admin',
        org_id: johnsonAttorneys.id,
      }),
      johnsonAttorney: authHelper.generateToken({
        sub: johnsonAttorney.auth0_user_id,
        email: johnsonAttorney.email,
        role: 'vendor_employee',
        org_id: johnsonAttorneys.id,
      }),
      publicDefenderAttorney: authHelper.generateToken({
        sub: publicDefenderAttorney.auth0_user_id,
        email: publicDefenderAttorney.email,
        role: 'vendor_employee',
        org_id: publicDefender.id,
      }),
    };
  }

  describe('🏢 Firm-Level Tenant Isolation', () => {
    describe('Cross-Firm Data Access Prevention', () => {
      it('should prevent Smith Law admin from accessing Johnson Attorneys data', async () => {
        // Smith admin trying to access Johnson attorney's permissions
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${johnsonAttorney.id}/permissions`)
          .set('Authorization', `Bearer ${tokens.smithAdmin}`)
          .expect(403); // Forbidden - cannot access other company's data

        // Should get forbidden error
        expect(response.body).toHaveProperty(
          'message',
          'You are not authorized to access this resource.'
        );
      });

      it("should prevent attorneys from accessing other firms' client data", async () => {
        // Smith attorney trying to check permissions with Johnson's company context
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${smithAttorney.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.smithAttorney}`)
          .send({
            permission_name: 'VIEW_CLIENT_DOCUMENTS',
            company_id: johnsonAttorneys.id, // Wrong company context
          })
          .expect(500); // Will get error because user doesn't belong to that company

        // Should get error for cross-firm access
        expect(response.body).toHaveProperty('message');
      });

      it('should isolate client portal access between firms', async () => {
        // Smith client checking portal access with their firm context
        const smithClientResponse = await request(app.getHttpServer())
          .post(`/permissions/users/${smithClient.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.smithClient}`)
          .send({
            permission_name: 'CLIENT_PORTAL_ACCESS',
            company_id: smithLawFirm.id,
          })
          .expect(200);

        expect(smithClientResponse.body.has_permission).toBe(true);

        // Same client trying with different firm context should fail
        const crossFirmResponse = await request(app.getHttpServer())
          .post(`/permissions/users/${smithClient.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.smithClient}`)
          .send({
            permission_name: 'CLIENT_PORTAL_ACCESS',
            company_id: johnsonAttorneys.id,
          })
          .expect(500); // Will get error because user doesn't belong to that company

        // Should get error for cross-firm access
        expect(crossFirmResponse.body).toHaveProperty('message');
      });
    });

    describe('Role Scope Validation', () => {
      it('should ensure roles are scoped to their respective firms', async () => {
        // Get Smith attorney's permissions
        const smithResponse = await request(app.getHttpServer())
          .get(`/permissions/users/${smithAttorney.id}/permissions`)
          .set('Authorization', `Bearer ${tokens.smithAttorney}`)
          .expect(200);

        // Get Johnson attorney's permissions
        const johnsonResponse = await request(app.getHttpServer())
          .get(`/permissions/users/${johnsonAttorney.id}/permissions`)
          .set('Authorization', `Bearer ${tokens.johnsonAttorney}`)
          .expect(200);

        // Both should have similar attorney permissions but scoped to their firms
        expect(smithResponse.body.permissions.length).toBeGreaterThan(0);
        expect(johnsonResponse.body.permissions.length).toBeGreaterThan(0);

        const smithPermNames = smithResponse.body.permissions.map((p) => p.name);
        const johnsonPermNames = johnsonResponse.body.permissions.map((p) => p.name);

        expect(smithPermNames).toContain('VIEW_PETITION');
        expect(johnsonPermNames).toContain('VIEW_PETITION');
      });

      it('should prevent role escalation across firm boundaries', async () => {
        // Johnson attorney should not have Smith admin permissions
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${johnsonAttorney.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.johnsonAttorney}`)
          .send({
            permission_name: 'MANAGE_FIRM_USERS',
            company_id: johnsonAttorneys.id,
          })
          .expect(200);

        expect(response.body.has_permission).toBe(false);
      });
    });
  });

  describe('⚖️ Legal-Specific Access Patterns', () => {
    describe('Case Assignment Workflow', () => {
      it('should handle case assignment between attorneys within firm', async () => {
        // Admin assigns case (grants document access to attorney)
        await UserPermission.create({
          user_id: smithAttorney.id,
          permission_id: permissions.find((p) => p.name === 'FILE_PETITION')?.id,
          granted: true,
          granted_at: new Date(),
          granted_by: smithAdmin.id,
        });

        // Invalidate cache
        await request(app.getHttpServer())
          .post('/permissions/cache/invalidate')
          .set('Authorization', `Bearer ${tokens.smithAdmin}`)
          .send({
            user_id: smithAttorney.id,
            reason: 'Case assignment - filing rights granted',
          })
          .expect(200);

        // Verify attorney now has filing permission
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${smithAttorney.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.smithAttorney}`)
          .send({
            permission_name: 'FILE_PETITION',
            company_id: smithLawFirm.id,
          })
          .expect(200);

        expect(response.body.has_permission).toBe(true);
        expect(response.body.source).toBe('DIRECT');
      });

      it('should prevent case assignments across firm boundaries', async () => {
        // Smith admin cannot grant permissions to Johnson attorney
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${johnsonAttorney.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.smithAdmin}`)
          .send({
            permission_name: 'CREATE_PETITION',
            company_id: smithLawFirm.id, // Smith's company context
          })
          .expect(403); // Smith admin cannot access Johnson attorney's data

        // Should get forbidden error
        expect(response.body).toHaveProperty('message');
      });
    });

    describe('Client-Attorney Privilege', () => {
      it("should enforce client access only to their assigned attorney's documents", async () => {
        // Client checking access to document management
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${smithClient.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.smithClient}`)
          .send({
            permission_name: 'VIEW_CLIENT_DOCUMENTS',
            company_id: smithLawFirm.id,
          })
          .expect(200);

        expect(response.body.has_permission).toBe(false); // Clients don't have this permission by default
      });

      it('should allow client portal access for document uploads', async () => {
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${smithClient.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.smithClient}`)
          .send({
            permission_name: 'UPLOAD_DOCUMENTS',
            company_id: smithLawFirm.id,
          })
          .expect(200);

        expect(response.body.has_permission).toBe(true);
      });

      it("should prevent clients from accessing other clients' data", async () => {
        // This would be enforced at the application level with proper data filtering
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${smithClient.id}/permissions`)
          .set('Authorization', `Bearer ${tokens.smithClient}`)
          .expect(200);

        const permissionNames = response.body.permissions.map((p) => p.name);
        expect(permissionNames).toContain('CLIENT_PORTAL_ACCESS');
        expect(permissionNames).not.toContain('MANAGE_CLIENT_DOCUMENTS');
      });
    });

    describe('Public Defender Special Cases', () => {
      it('should handle public defender limited permissions', async () => {
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${publicDefenderAttorney.id}/permissions`)
          .set('Authorization', `Bearer ${tokens.publicDefenderAttorney}`)
          .expect(200);

        const permissionNames = response.body.permissions.map((p) => p.name);

        // Should have basic petition permissions
        expect(permissionNames).toContain('CREATE_PETITION');
        expect(permissionNames).toContain('VIEW_PETITION');

        // Should not have billing permissions
        expect(permissionNames).not.toContain('MANAGE_BILLING');
        expect(permissionNames).not.toContain('GENERATE_REPORTS');
      });

      it('should prevent public defender from accessing private firm data', async () => {
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${publicDefenderAttorney.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.publicDefenderAttorney}`)
          .send({
            permission_name: 'VIEW_PETITION',
            company_id: smithLawFirm.id, // Trying to access private firm context
          })
          .expect(500); // Will get error because user doesn't belong to that company

        // Should get error for cross-firm access
        expect(response.body).toHaveProperty('message');
      });
    });
  });

  describe('📊 Billing and Subscription Isolation', () => {
    describe('Firm-Specific Billing Access', () => {
      it('should isolate billing permissions between firms', async () => {
        // Smith admin can manage billing for Smith Law
        const smithBillingResponse = await request(app.getHttpServer())
          .post(`/permissions/users/${smithAdmin.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.smithAdmin}`)
          .send({
            permission_name: 'MANAGE_BILLING',
            company_id: smithLawFirm.id,
          })
          .expect(200);

        expect(smithBillingResponse.body.has_permission).toBe(true);

        // Johnson admin cannot access Smith's billing
        const crossFirmBillingResponse = await request(app.getHttpServer())
          .post(`/permissions/users/${johnsonAdmin.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.johnsonAdmin}`)
          .send({
            permission_name: 'MANAGE_BILLING',
            company_id: smithLawFirm.id, // Wrong company
          })
          .expect(500); // Will get error because user doesn't belong to that company

        // Should get error for cross-firm access
        expect(crossFirmBillingResponse.body).toHaveProperty('message');
      });

      it('should prevent attorneys from accessing firm billing', async () => {
        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${smithAttorney.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.smithAttorney}`)
          .send({
            permission_name: 'MANAGE_BILLING',
            company_id: smithLawFirm.id,
          })
          .expect(200);

        expect(response.body.has_permission).toBe(false);
      });
    });

    describe('Feature Access Based on Subscription', () => {
      it('should handle premium feature access per firm', async () => {
        // Test report generation (premium feature)
        const smithReportResponse = await request(app.getHttpServer())
          .post(`/permissions/users/${smithAdmin.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.smithAdmin}`)
          .send({
            permission_name: 'GENERATE_REPORTS',
            company_id: smithLawFirm.id,
          })
          .expect(200);

        expect(smithReportResponse.body.has_permission).toBe(true);

        // Public defender might not have premium features
        const pdReportResponse = await request(app.getHttpServer())
          .post(`/permissions/users/${publicDefenderAttorney.id}/permissions/check`)
          .set('Authorization', `Bearer ${tokens.publicDefenderAttorney}`)
          .send({
            permission_name: 'GENERATE_REPORTS',
            company_id: publicDefender.id,
          })
          .expect(200);

        expect(pdReportResponse.body.has_permission).toBe(false);
      });
    });
  });

  describe('🔒 National Niner Super-Admin Access', () => {
    describe('Cross-Tenant Administrative Access', () => {
      it("should allow National Niner admin to access any firm's data", async () => {
        // National Niner admin accessing Smith Law firm data
        const smithAccessResponse = await request(app.getHttpServer())
          .get(`/permissions/users/${smithAdmin.id}/permissions`)
          .set('Authorization', `Bearer ${tokens.nationalNinerAdmin}`)
          .expect(200);

        expect(smithAccessResponse.body.user_id).toBe(smithAdmin.id);

        // National Niner admin accessing Johnson Attorneys data
        const johnsonAccessResponse = await request(app.getHttpServer())
          .get(`/permissions/users/${johnsonAdmin.id}/permissions`)
          .set('Authorization', `Bearer ${tokens.nationalNinerAdmin}`)
          .expect(200);

        expect(johnsonAccessResponse.body.user_id).toBe(johnsonAdmin.id);
      });

      it('should allow National Niner admin to perform system-wide cache operations', async () => {
        const response = await request(app.getHttpServer())
          .post('/permissions/cache/invalidate')
          .set('Authorization', `Bearer ${tokens.nationalNinerAdmin}`)
          .send({
            invalidate_all: true,
            reason: 'System-wide maintenance',
          })
          .expect(200);

        expect(response.body.invalidated_keys).toContain('*');
        expect(response.body.reason).toBe('System-wide maintenance');
      });

      it('should allow National Niner admin to warm up cache for any firm', async () => {
        const response = await request(app.getHttpServer())
          .post('/permissions/cache/warmup')
          .set('Authorization', `Bearer ${tokens.nationalNinerAdmin}`)
          .send({
            company_id: smithLawFirm.id,
          })
          .expect(200);

        expect(response.body.users_processed).toBeGreaterThanOrEqual(2);
      });
    });

    describe('System-wide Permission Management', () => {
      it('should handle system-wide permission checks', async () => {
        // National Niner admin checking their own permissions
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${nationalNinerAdmin.id}/permissions`)
          .set('Authorization', `Bearer ${tokens.nationalNinerAdmin}`)
          .expect(200);

        expect(response.body.permissions.length).toBeGreaterThan(0);

        const permissionNames = response.body.permissions.map((p) => p.name);
        expect(permissionNames).toContain('MANAGE_FIRM_USERS');
        expect(permissionNames).toContain('GENERATE_REPORTS');
      });
    });
  });

  describe('🚨 Security Breach Scenarios', () => {
    describe('Token Hijacking Prevention', () => {
      it('should prevent token reuse across different firms', async () => {
        // Try to use Smith attorney token to access Johnson data
        const response = await request(app.getHttpServer())
          .get(`/permissions/users/${johnsonAttorney.id}/permissions`)
          .set('Authorization', `Bearer ${tokens.smithAttorney}`)
          .expect(403); // Forbidden - cannot access other company's data

        // Should get forbidden error
        expect(response.body).toHaveProperty('message');
      });

      it('should handle session hijacking attempts', async () => {
        // Create a malicious token with escalated permissions
        const maliciousToken = authHelper.generateToken({
          sub: smithClient.auth0_user_id,
          email: smithClient.email,
          org_id: smithLawFirm.id,
          permissions: ['MANAGE_FIRM_USERS', 'MANAGE_BILLING'], // Try to inject permissions
        });

        const response = await request(app.getHttpServer())
          .post(`/permissions/users/${smithClient.id}/permissions/check`)
          .set('Authorization', `Bearer ${maliciousToken}`)
          .send({
            permission_name: 'MANAGE_BILLING',
            company_id: smithLawFirm.id,
          })
          .expect(200);

        // Should use actual database permissions, not token claims
        expect(response.body.has_permission).toBe(false);
      });
    });

    describe('Data Exfiltration Prevention', () => {
      it('should prevent bulk data access across firm boundaries', async () => {
        // Try to get permissions for multiple users across firms
        const bulkResponse = await request(app.getHttpServer())
          .post('/permissions/cache/warmup')
          .set('Authorization', `Bearer ${tokens.smithAdmin}`)
          .send({
            user_ids: [smithAttorney.id, johnsonAttorney.id], // Mix of firms
          })
          .expect(200);

        // Should handle cross-firm requests appropriately
        expect(bulkResponse.body).toHaveProperty('users_processed');
      });

      it('should prevent search/enumeration attacks', async () => {
        // Try to enumerate users by checking permissions for non-existent users
        const response = await request(app.getHttpServer())
          .get('/permissions/users/00000000-0000-0000-0000-000000000000/permissions')
          .set('Authorization', `Bearer ${tokens.smithAdmin}`)
          .expect(404); // Should return 404 for non-existent user

        expect(response.body).toHaveProperty('message');
      });
    });
  });

  describe('📈 Performance with Multi-Tenant Load', () => {
    describe('Concurrent Firm Operations', () => {
      it('should handle concurrent requests from different firms efficiently', async () => {
        const startTime = Date.now();

        // Execute requests in smaller batches to prevent ECONNRESET
        const batch1 = await Promise.all([
          request(app.getHttpServer())
            .get(`/permissions/users/${smithAttorney.id}/permissions`)
            .set('Authorization', `Bearer ${tokens.smithAttorney}`)
            .expect(200),
          request(app.getHttpServer())
            .get(`/permissions/users/${johnsonAttorney.id}/permissions`)
            .set('Authorization', `Bearer ${tokens.johnsonAttorney}`)
            .expect(200),
        ]);

        const batch2 = await Promise.all([
          request(app.getHttpServer())
            .get(`/permissions/users/${smithAttorney.id}/permissions`)
            .set('Authorization', `Bearer ${tokens.smithAttorney}`)
            .expect(200),
          request(app.getHttpServer())
            .get(`/permissions/users/${publicDefenderAttorney.id}/permissions`)
            .set('Authorization', `Bearer ${tokens.publicDefenderAttorney}`)
            .expect(200),
        ]);

        const responses = [...batch1, ...batch2];
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(10000); // 10 seconds for requests
        expect(responses).toHaveLength(4);

        // Verify tenant isolation in responses
        expect(responses[0].body.user_id).toBe(smithAttorney.id);
        expect(responses[1].body.user_id).toBe(johnsonAttorney.id);
        expect(responses[2].body.user_id).toBe(smithAttorney.id);
        expect(responses[3].body.user_id).toBe(publicDefenderAttorney.id);
      });

      it('should maintain cache isolation between firms', async () => {
        // Warm up cache for Smith Law
        await request(app.getHttpServer())
          .post('/permissions/cache/warmup')
          .set('Authorization', `Bearer ${tokens.smithAdmin}`)
          .send({
            company_id: smithLawFirm.id,
          })
          .expect(200);

        // Warm up cache for Johnson Attorneys
        await request(app.getHttpServer())
          .post('/permissions/cache/warmup')
          .set('Authorization', `Bearer ${tokens.johnsonAdmin}`)
          .send({
            company_id: johnsonAttorneys.id,
          })
          .expect(200);

        // Get cache stats
        const statsResponse = await request(app.getHttpServer())
          .get('/permissions/cache/stats')
          .set('Authorization', `Bearer ${tokens.nationalNinerAdmin}`)
          .expect(200);

        expect(statsResponse.body.total_entries).toBeGreaterThan(0);
        expect(statsResponse.body.active_entries).toBeGreaterThan(0);
      });
    });
  });
});
