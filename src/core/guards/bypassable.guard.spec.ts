import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { BypassableGuard } from './bypassable.guard';
import { PermissionsGuard } from './permissions.guard';
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

describe('BypassableGuard', () => {
  let guard: BypassableGuard;
  let permissionsService: jest.Mocked<PermissionsService>;
  let permissionsGuard: jest.Mocked<PermissionsGuard>;

  const mockPermissionsService = {
    hasPermission: jest.fn(),
    isSuperAdmin: jest.fn(),
  };

  const mockPermissionsGuard = {
    canActivate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BypassableGuard,
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: PermissionsGuard,
          useValue: mockPermissionsGuard,
        },
      ],
    }).compile();

    guard = module.get<BypassableGuard>(BypassableGuard);
    permissionsService = module.get(PermissionsService);
    permissionsGuard = module.get(PermissionsGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Guard Functionality', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should delegate to permissions guard when no user in request', async () => {
      const requestWithoutUser = { params: {}, query: {}, body: {}, headers: {} };
      const context = TestDataFactory.createMockExecutionContext(requestWithoutUser);

      mockPermissionsGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsGuard.canActivate).toHaveBeenCalledWith(context);
      expect(permissionsService.hasPermission).not.toHaveBeenCalled();
    });
  });

  describe('Super Admin Bypass - Enum Role', () => {
    it('should bypass permissions guard for SUPER_ADMIN enum role', async () => {
      const superAdminUser = TestDataFactory.createMockUser({
        role: UserRole.SUPER_ADMIN,
        id: 'super-admin-123',
      });
      const request = TestDataFactory.createMockRequest(superAdminUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsGuard.canActivate).not.toHaveBeenCalled();
      expect(permissionsService.isSuperAdmin).toHaveBeenCalledWith(
        'super-admin-123',
        'company-456'
      );
    });

    it('should delegate to permissions guard for non-super admin enum roles', async () => {
      const regularAdmin = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_ADMIN,
        id: 'regular-admin-123',
      });
      const request = TestDataFactory.createMockRequest(regularAdmin);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(false);
      mockPermissionsGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsGuard.canActivate).toHaveBeenCalledWith(context);
      expect(permissionsService.isSuperAdmin).toHaveBeenCalled();
    });
  });

  describe('Super Admin Bypass - Permission Role', () => {
    it('should bypass permissions guard for users with super admin permission', async () => {
      const userWithSuperAdminPermission = TestDataFactory.createMockUser({
        role: UserRole.ACME_ADMIN,
        id: 'special-admin-456',
      });
      const request = TestDataFactory.createMockRequest(userWithSuperAdminPermission);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsGuard.canActivate).not.toHaveBeenCalled();
      expect(permissionsService.isSuperAdmin).toHaveBeenCalledWith(
        'special-admin-456',
        'company-456'
      );
    });

    it('should delegate to permissions guard for users without super admin permission', async () => {
      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_EMPLOYEE,
        id: 'employee-789',
      });
      const request = TestDataFactory.createMockRequest(regularUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(false);
      mockPermissionsGuard.canActivate.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(permissionsGuard.canActivate).toHaveBeenCalledWith(context);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fallback to permissions guard on super admin check error', async () => {
      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_ADMIN,
        id: 'error-user-123',
      });
      const request = TestDataFactory.createMockRequest(regularUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockRejectedValue(new Error('Database connection failed'));
      mockPermissionsGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsGuard.canActivate).toHaveBeenCalledWith(context);
    });

    it('should maintain original permissions guard behavior on fallback', async () => {
      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.CLIENT,
        id: 'client-user-456',
      });
      const request = TestDataFactory.createMockRequest(regularUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(false);
      mockPermissionsGuard.canActivate.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(permissionsGuard.canActivate).toHaveBeenCalledWith(context);
    });
  });

  describe('Integration Scenarios', () => {
    it('should properly integrate super admin bypass with complex permission requirements', async () => {
      const superAdminUser = TestDataFactory.createMockUser({
        role: UserRole.SUPER_ADMIN,
        id: 'integration-super-admin',
        company_id: 'integration-company',
      });
      const request = TestDataFactory.createMockRequest(superAdminUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      // Even if permissions guard would fail, super admin should bypass
      mockPermissionsGuard.canActivate.mockResolvedValue(false);
      permissionsService.isSuperAdmin.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsGuard.canActivate).not.toHaveBeenCalled();
    });

    it('should handle cross-company super admin access correctly', async () => {
      const crossCompanySuperAdmin = TestDataFactory.createMockUser({
        role: UserRole.SUPER_ADMIN,
        id: 'cross-company-super-admin',
        company_id: 'company-A',
      });
      const request = TestDataFactory.createMockRequest(crossCompanySuperAdmin);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsGuard.canActivate).not.toHaveBeenCalled();
      // Super admin should bypass without needing permission check
      expect(permissionsService.isSuperAdmin).toHaveBeenCalledWith(
        'cross-company-super-admin',
        'company-A'
      );
    });

    it('should preserve request context for downstream processing', async () => {
      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_ADMIN,
        id: 'context-preservation-user',
      });
      const request = TestDataFactory.createMockRequest(regularUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(false);
      mockPermissionsGuard.canActivate.mockImplementation((ctx) => {
        // Verify context is passed through correctly
        expect(ctx).toBe(context);
        return Promise.resolve(true);
      });

      await guard.canActivate(context);

      expect(mockPermissionsGuard.canActivate).toHaveBeenCalledWith(context);
    });
  });

  describe('Performance Optimization', () => {
    it('should optimize for enum-based super admin detection', async () => {
      const superAdminUser = TestDataFactory.createMockUser({
        role: UserRole.SUPER_ADMIN,
        id: 'performance-super-admin',
      });
      const request = TestDataFactory.createMockRequest(superAdminUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(true);

      const startTime = Date.now();
      const result = await guard.canActivate(context);
      const endTime = Date.now();

      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(10); // Should be nearly instantaneous
      expect(permissionsService.isSuperAdmin).toHaveBeenCalled();
      expect(permissionsGuard.canActivate).not.toHaveBeenCalled();
    });

    it('should minimize database calls for non-super admins', async () => {
      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_EMPLOYEE,
        id: 'minimal-db-user',
      });
      const request = TestDataFactory.createMockRequest(regularUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      permissionsService.isSuperAdmin.mockResolvedValue(false);
      mockPermissionsGuard.canActivate.mockResolvedValue(true);

      await guard.canActivate(context);

      // Should only call permission check once
      expect(permissionsService.isSuperAdmin).toHaveBeenCalledTimes(1);
      expect(permissionsGuard.canActivate).toHaveBeenCalledTimes(1);
    });
  });
});
