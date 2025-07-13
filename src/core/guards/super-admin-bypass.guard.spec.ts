import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { SuperAdminBypassGuard } from './super-admin-bypass.guard';
import { PermissionsService } from '../../modules/role/permissions.service';
import { UserRole } from '../../modules/auth/entities/user.entity';
import {
  ServicePermissionCheckResultDto,
  PermissionSourceType,
} from '../../modules/role/dto/permissions-service.dto';

// Mock data factory
class TestDataFactory {
  static createMockUser(overrides: Partial<any> = {}): any {
    return {
      id: 'user-123',
      company_id: 'company-456',
      email: 'test@example.com',
      role: UserRole.VENDOR_ADMIN,
      ...overrides,
    };
  }

  static createMockRequest(user: any = this.createMockUser()): any {
    return {
      user: user,
      params: {},
      query: {},
      body: {},
      headers: {},
    };
  }

  static createMockExecutionContext(request?: any): ExecutionContext {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request || this.createMockRequest()),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as ExecutionContext;
  }

  static createPermissionCheckResult(granted: boolean): ServicePermissionCheckResultDto {
    return {
      granted,
      permission_name: 'super_admin.bypass_company_restrictions',
      user_id: 'user-123',
      source: granted ? PermissionSourceType.ROLE : undefined,
      source_role_name: granted ? 'Super Admin' : undefined,
      checked_at: new Date(),
      from_cache: false,
    };
  }
}

describe('SuperAdminBypassGuard', () => {
  let guard: SuperAdminBypassGuard;
  let permissionsService: jest.Mocked<PermissionsService>;

  const mockPermissionsService = {
    hasPermission: jest.fn(),
    isSuperAdmin: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperAdminBypassGuard,
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
      ],
    }).compile();

    guard = module.get<SuperAdminBypassGuard>(SuperAdminBypassGuard);
    permissionsService = module.get(PermissionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Guard Functionality', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should allow access when no user in request', async () => {
      const requestWithoutUser = { params: {}, query: {}, body: {}, headers: {} };
      const context = TestDataFactory.createMockExecutionContext(requestWithoutUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsService.hasPermission).not.toHaveBeenCalled();
    });
  });

  describe('Super Admin Enum Role Detection', () => {
    it('should detect and bypass for SUPER_ADMIN enum role', async () => {
      const superAdminUser = TestDataFactory.createMockUser({
        role: UserRole.SUPER_ADMIN,
        id: 'super-admin-123',
      });
      const request = TestDataFactory.createMockRequest(superAdminUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.superAdminBypass).toBe(true);
      expect(permissionsService.isSuperAdmin).toHaveBeenCalledWith(
        'super-admin-123',
        'company-456'
      );
    });

    it('should not bypass for regular admin roles', async () => {
      const regularAdmin = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_ADMIN,
        id: 'regular-admin-123',
      });
      const request = TestDataFactory.createMockRequest(regularAdmin);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.superAdminBypass).toBeUndefined();
      expect(permissionsService.isSuperAdmin).toHaveBeenCalledWith(
        'regular-admin-123',
        'company-456'
      );
    });

    it('should not bypass for CLIENT role', async () => {
      const clientUser = TestDataFactory.createMockUser({
        role: UserRole.CLIENT,
        id: 'client-123',
      });
      const request = TestDataFactory.createMockRequest(clientUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.superAdminBypass).toBeUndefined();
    });
  });

  describe('Permission-Based Super Admin Detection', () => {
    it('should detect and bypass for users with super admin permission', async () => {
      const userWithSuperAdminPermission = TestDataFactory.createMockUser({
        role: UserRole.ACME_ADMIN,
        id: 'special-admin-456',
      });
      const request = TestDataFactory.createMockRequest(userWithSuperAdminPermission);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.superAdminBypass).toBe(true);
      expect(permissionsService.isSuperAdmin).toHaveBeenCalledWith(
        'special-admin-456',
        'company-456'
      );
    });

    it('should not bypass for users without super admin permission', async () => {
      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_EMPLOYEE,
        id: 'employee-789',
      });
      const request = TestDataFactory.createMockRequest(regularUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.superAdminBypass).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should continue to next guard on permission check error', async () => {
      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_ADMIN,
        id: 'error-user-123',
      });
      const request = TestDataFactory.createMockRequest(regularUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockRejectedValue(new Error('Database connection failed'));

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.superAdminBypass).toBeUndefined();
    });

    it('should handle null permission service response', async () => {
      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_ADMIN,
        id: 'null-response-user',
      });
      const request = TestDataFactory.createMockRequest(regularUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(null as any);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.superAdminBypass).toBeUndefined();
    });
  });

  describe('Cross-Company Context', () => {
    it('should handle users from different companies', async () => {
      const crossCompanyUser = TestDataFactory.createMockUser({
        role: UserRole.SUPER_ADMIN,
        id: 'cross-company-admin',
        company_id: 'other-company-789',
      });
      const request = TestDataFactory.createMockRequest(crossCompanyUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.superAdminBypass).toBe(true);
      expect(permissionsService.isSuperAdmin).toHaveBeenCalledWith(
        'cross-company-admin',
        'other-company-789'
      );
    });

    it('should pass correct company context to permission check', async () => {
      const userWithCompany = TestDataFactory.createMockUser({
        role: UserRole.ACME_ADMIN,
        id: 'company-user',
        company_id: 'specific-company-999',
      });
      const request = TestDataFactory.createMockRequest(userWithCompany);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(false);

      await guard.canActivate(context);

      expect(permissionsService.isSuperAdmin).toHaveBeenCalledWith(
        'company-user',
        'specific-company-999'
      );
    });
  });

  describe('Performance Considerations', () => {
    it('should prioritize enum check over permission check for performance', async () => {
      const superAdminUser = TestDataFactory.createMockUser({
        role: UserRole.SUPER_ADMIN,
        id: 'performance-test-admin',
      });
      const request = TestDataFactory.createMockRequest(superAdminUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.superAdminBypass).toBe(true);
      expect(permissionsService.isSuperAdmin).toHaveBeenCalledWith(
        'performance-test-admin',
        'company-456'
      );
    });

    it('should only call permission service when enum check fails', async () => {
      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_ADMIN,
        id: 'performance-regular-user',
      });
      const request = TestDataFactory.createMockRequest(regularUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(false);

      await guard.canActivate(context);

      expect(permissionsService.isSuperAdmin).toHaveBeenCalledTimes(1);
    });
  });
});
