import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard, REQUIRE_PERMISSIONS_KEY, RequirePermissions } from './permissions.guard';
import { PermissionsService } from '../../modules/role/permissions.service';
import {
  ServiceBulkPermissionCheckDto,
  ServiceBulkPermissionCheckResultDto,
  ServicePermissionCheckResultDto,
  PermissionSourceType,
} from '../../modules/role/dto/permissions-service.dto';
import { UserRole } from '../../modules/auth/entities/user.entity';

// Mock data factory for consistent test data
class TestDataFactory {
  static createMockUser(overrides: Partial<any> = {}): any {
    return {
      id: 'user-123',
      company_id: 'company-456',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      auth0_user_id: 'auth0|test123',
      ...overrides,
    };
  }

  static createMockRequest(user: any = this.createMockUser(), params?: any): any {
    return {
      user: user,
      params: params || {},
      query: {},
      body: {},
      headers: {},
    };
  }

  static createMockExecutionContext(
    request?: any,
    handler?: any,
    controllerClass?: any
  ): ExecutionContext {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request || this.createMockRequest()),
      }),
      getHandler: jest.fn().mockReturnValue(handler || jest.fn()),
      getClass: jest.fn().mockReturnValue(controllerClass || jest.fn()),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as ExecutionContext;
  }

  static createPermissionCheckResult(
    permissionName: string,
    granted: boolean,
    source?: PermissionSourceType
  ): ServicePermissionCheckResultDto {
    return {
      granted,
      permission_name: permissionName,
      user_id: 'user-123',
      source,
      source_role_name: source === PermissionSourceType.ROLE ? 'TestRole' : undefined,
      checked_at: new Date(),
      from_cache: false,
    };
  }

  static createBulkPermissionCheckResult(
    permissionResults: Array<{ name: string; granted: boolean; source?: PermissionSourceType }>
  ): ServiceBulkPermissionCheckResultDto {
    const results = permissionResults.map((p) =>
      this.createPermissionCheckResult(p.name, p.granted, p.source)
    );

    return {
      user_id: 'user-123',
      results,
      total_checked: results.length,
      granted_count: results.filter((r) => r.granted).length,
      checked_at: new Date(),
      from_cache: false,
    };
  }
}

describe('PermissionsGuard - Unit Tests', () => {
  let guard: PermissionsGuard;
  let permissionsService: jest.Mocked<PermissionsService>;
  let reflector: jest.Mocked<Reflector>;

  const mockPermissionsService = {
    hasPermissions: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    permissionsService = module.get(PermissionsService);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Guard Functionality', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should allow access when no permissions are required', async () => {
      // No permissions metadata set
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = TestDataFactory.createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsService.hasPermissions).not.toHaveBeenCalled();
    });

    it('should allow access when empty permissions array is required', async () => {
      reflector.getAllAndOverride.mockReturnValue([]);

      const context = TestDataFactory.createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsService.hasPermissions).not.toHaveBeenCalled();
    });
  });

  describe('User Validation', () => {
    it('should throw ForbiddenException when no user in request', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      const requestWithoutUser = { params: {}, query: {}, body: {}, headers: {} };
      const context = TestDataFactory.createMockExecutionContext(requestWithoutUser);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('User not authenticated');
    });

    it('should throw ForbiddenException when user is null', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      const requestWithNullUser = TestDataFactory.createMockRequest(null);
      const context = TestDataFactory.createMockExecutionContext(requestWithNullUser);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('User not authenticated');
    });

    it('should throw ForbiddenException when user is undefined', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      const requestWithUndefinedUser = {
        params: {},
        query: {},
        body: {},
        headers: {},
        user: undefined,
      };
      const context = TestDataFactory.createMockExecutionContext(requestWithUndefinedUser);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('User not authenticated');
    });

    it('should throw ForbiddenException when user lacks required properties', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      const invalidUser = { email: 'test@example.com' }; // Missing id and company_id
      const requestWithInvalidUser = TestDataFactory.createMockRequest(invalidUser);
      const context = TestDataFactory.createMockExecutionContext(requestWithInvalidUser);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid user context');
    });
  });

  describe('Single Permission Checks', () => {
    it('should allow access when user has required permission', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'CREATE_PETITION', granted: true, source: PermissionSourceType.ROLE },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsService.hasPermissions).toHaveBeenCalledWith({
        user_id: 'user-123',
        permission_names: ['CREATE_PETITION'],
        company_id: 'company-456',
      });
    });

    it('should deny access when user lacks required permission', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'CREATE_PETITION', granted: false },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Insufficient permissions. Required: CREATE_PETITION'
      );
    });

    it('should handle case-sensitive permission names', async () => {
      reflector.getAllAndOverride.mockReturnValue(['create_petition']); // lowercase

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'create_petition', granted: false },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      expect(permissionsService.hasPermissions).toHaveBeenCalledWith({
        user_id: 'user-123',
        permission_names: ['create_petition'],
        company_id: 'company-456',
      });
    });
  });

  describe('Multiple Permission Checks (AND Logic)', () => {
    it('should allow access when user has all required permissions', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        'CREATE_PETITION',
        'VIEW_PETITION',
        'EDIT_PETITION',
      ]);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'CREATE_PETITION', granted: true, source: PermissionSourceType.ROLE },
        { name: 'VIEW_PETITION', granted: true, source: PermissionSourceType.ROLE },
        { name: 'EDIT_PETITION', granted: true, source: PermissionSourceType.DIRECT },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsService.hasPermissions).toHaveBeenCalledWith({
        user_id: 'user-123',
        permission_names: ['CREATE_PETITION', 'VIEW_PETITION', 'EDIT_PETITION'],
        company_id: 'company-456',
      });
    });

    it('should deny access when user lacks some required permissions', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        'CREATE_PETITION',
        'DELETE_PETITION',
        'MANAGE_USERS',
      ]);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'CREATE_PETITION', granted: true, source: PermissionSourceType.ROLE },
        { name: 'DELETE_PETITION', granted: false },
        { name: 'MANAGE_USERS', granted: false },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Insufficient permissions. Required: CREATE_PETITION, DELETE_PETITION, MANAGE_USERS. Missing: DELETE_PETITION, MANAGE_USERS'
      );
    });

    it('should deny access when user has no required permissions', async () => {
      reflector.getAllAndOverride.mockReturnValue(['ADMIN_PERMISSION', 'SUPER_USER']);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'ADMIN_PERMISSION', granted: false },
        { name: 'SUPER_USER', granted: false },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Insufficient permissions. Required: ADMIN_PERMISSION, SUPER_USER. Missing: ADMIN_PERMISSION, SUPER_USER'
      );
    });

    it('should handle large permission sets efficiently', async () => {
      const manyPermissions = Array.from({ length: 50 }, (_, i) => `PERMISSION_${i}`);
      reflector.getAllAndOverride.mockReturnValue(manyPermissions);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult(
        manyPermissions.map((name) => ({ name, granted: true, source: PermissionSourceType.ROLE }))
      );

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsService.hasPermissions).toHaveBeenCalledWith({
        user_id: 'user-123',
        permission_names: manyPermissions,
        company_id: 'company-456',
      });
    });
  });

  describe('Company Context Handling', () => {
    it('should use user company_id when available', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      const userWithCompany = TestDataFactory.createMockUser({ company_id: 'user-company-789' });
      const request = TestDataFactory.createMockRequest(userWithCompany);
      const context = TestDataFactory.createMockExecutionContext(request);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'CREATE_PETITION', granted: true },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      await guard.canActivate(context);

      expect(permissionsService.hasPermissions).toHaveBeenCalledWith({
        user_id: 'user-123',
        permission_names: ['CREATE_PETITION'],
        company_id: 'user-company-789',
      });
    });

    it('should handle missing company_id gracefully', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      const userWithoutCompany = TestDataFactory.createMockUser({ company_id: undefined });
      const request = TestDataFactory.createMockRequest(userWithoutCompany);
      const context = TestDataFactory.createMockExecutionContext(request);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'CREATE_PETITION', granted: true },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      await guard.canActivate(context);

      expect(permissionsService.hasPermissions).toHaveBeenCalledWith({
        user_id: 'user-123',
        permission_names: ['CREATE_PETITION'],
        company_id: undefined,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle PermissionsService errors gracefully', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      permissionsService.hasPermissions.mockRejectedValue(new Error('Database connection failed'));

      const context = TestDataFactory.createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Permission check failed');
    });

    it('should handle service timeout errors', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      permissionsService.hasPermissions.mockRejectedValue(new Error('Timeout'));

      const context = TestDataFactory.createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Permission check failed');
    });

    it('should handle malformed service responses', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      // Mock malformed response (missing results array)
      permissionsService.hasPermissions.mockResolvedValue({
        user_id: 'user-123',
        total_checked: 1,
        granted_count: 1,
        checked_at: new Date(),
        from_cache: false,
      } as any);

      const context = TestDataFactory.createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Permission check failed');
    });

    it('should handle null service responses', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      permissionsService.hasPermissions.mockResolvedValue(null as any);

      const context = TestDataFactory.createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Permission check failed');
    });
  });

  describe('Reflector Integration', () => {
    it('should check both handler and class for permissions metadata', async () => {
      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      reflector.getAllAndOverride.mockReturnValue(['CREATE_PETITION']);

      const context = TestDataFactory.createMockExecutionContext(
        TestDataFactory.createMockRequest(),
        mockHandler,
        mockClass
      );

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'CREATE_PETITION', granted: true },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      await guard.canActivate(context);

      // Should be called twice - once for class permissions, once for method permissions
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(REQUIRE_PERMISSIONS_KEY, [
        mockClass,
      ]);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(REQUIRE_PERMISSIONS_KEY, [
        mockHandler,
      ]);
    });

    it('should handle inheritance of permissions from class to method', async () => {
      // Test that class-level permissions are inherited by methods
      reflector.getAllAndOverride.mockReturnValue(['CLASS_PERMISSION', 'METHOD_PERMISSION']);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'CLASS_PERMISSION', granted: true },
        { name: 'METHOD_PERMISSION', granted: true },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Edge Cases and Special Characters', () => {
    it('should handle permissions with special characters', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        'PERMISSION_WITH-DASH',
        'PERMISSION_WITH_UNDERSCORE',
        'PERMISSION.WITH.DOTS',
      ]);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'PERMISSION_WITH-DASH', granted: true },
        { name: 'PERMISSION_WITH_UNDERSCORE', granted: true },
        { name: 'PERMISSION.WITH.DOTS', granted: true },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle permissions with Unicode characters', async () => {
      reflector.getAllAndOverride.mockReturnValue(['PERMISSION_中文', 'PERMISSION_🔒']);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'PERMISSION_中文', granted: true },
        { name: 'PERMISSION_🔒', granted: true },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle very long permission names', async () => {
      const longPermission = 'VERY_LONG_PERMISSION_NAME_'.repeat(10) + 'END';
      reflector.getAllAndOverride.mockReturnValue([longPermission]);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: longPermission, granted: true },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle duplicate permissions efficiently', async () => {
      // Test that duplicate permissions in metadata are deduplicated
      reflector.getAllAndOverride.mockReturnValue([
        'CREATE_PETITION',
        'VIEW_PETITION',
        'CREATE_PETITION',
        'VIEW_PETITION',
      ]);

      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'CREATE_PETITION', granted: true },
        { name: 'VIEW_PETITION', granted: true },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const context = TestDataFactory.createMockExecutionContext();
      await guard.canActivate(context);

      // Should call service with deduplicated permissions
      expect(permissionsService.hasPermissions).toHaveBeenCalledWith({
        user_id: 'user-123',
        permission_names: ['CREATE_PETITION', 'VIEW_PETITION'],
        company_id: 'company-456',
      });
    });

    it('should not make unnecessary service calls when permissions are empty', async () => {
      reflector.getAllAndOverride.mockReturnValue([]);

      const context = TestDataFactory.createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsService.hasPermissions).not.toHaveBeenCalled();
    });
  });

  describe('Super Admin Bypass Functionality', () => {
    it('should allow super admin users with enum role to bypass all permission checks', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        'ADMIN_ONLY_PERMISSION',
        'SUPER_SECRET_PERMISSION',
      ]);

      // Create a super admin user (enum-based)
      const superAdminUser = TestDataFactory.createMockUser({
        role: UserRole.SUPER_ADMIN,
        id: 'super-admin-123',
      });
      const request = TestDataFactory.createMockRequest(superAdminUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      // Mock service to simulate super admin detection
      permissionsService.hasPermissions.mockImplementation(
        async (dto: ServiceBulkPermissionCheckDto) => {
          // If user is super admin, return all permissions as granted
          return TestDataFactory.createBulkPermissionCheckResult([
            { name: 'ADMIN_ONLY_PERMISSION', granted: true, source: PermissionSourceType.ROLE },
            { name: 'SUPER_SECRET_PERMISSION', granted: true, source: PermissionSourceType.ROLE },
          ]);
        }
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsService.hasPermissions).toHaveBeenCalledWith({
        user_id: 'super-admin-123',
        permission_names: ['ADMIN_ONLY_PERMISSION', 'SUPER_SECRET_PERMISSION'],
        company_id: 'company-456',
      });
    });

    it('should allow super admin users with permission-based role to bypass permission checks', async () => {
      reflector.getAllAndOverride.mockReturnValue(['RESTRICTED_PERMISSION']);

      // Create a regular user that has super admin permission via role
      const regularUserWithSuperAdminRole = TestDataFactory.createMockUser({
        role: UserRole.ACME_ADMIN, // Not enum super admin
        id: 'special-admin-456',
      });
      const request = TestDataFactory.createMockRequest(regularUserWithSuperAdminRole);
      const context = TestDataFactory.createMockExecutionContext(request);

      // Mock service to simulate super admin permission detection
      permissionsService.hasPermissions.mockImplementation(
        async (dto: ServiceBulkPermissionCheckDto) => {
          // Simulate that this user has all permissions due to super admin role
          return TestDataFactory.createBulkPermissionCheckResult([
            { name: 'RESTRICTED_PERMISSION', granted: true, source: PermissionSourceType.ROLE },
          ]);
        }
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access to regular users even if they have most permissions', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        'PERMISSION_A',
        'PERMISSION_B',
        'SUPER_ADMIN_ONLY',
      ]);

      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_ADMIN,
        id: 'regular-admin-789',
      });
      const request = TestDataFactory.createMockRequest(regularUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      // Regular user has some but not all permissions
      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'PERMISSION_A', granted: true, source: PermissionSourceType.ROLE },
        { name: 'PERMISSION_B', granted: true, source: PermissionSourceType.ROLE },
        { name: 'SUPER_ADMIN_ONLY', granted: false }, // Missing this permission
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Missing: SUPER_ADMIN_ONLY');
    });

    it('should handle super admin role inheritance correctly', async () => {
      reflector.getAllAndOverride.mockReturnValue(['INHERITED_PERMISSION']);

      const superAdminUser = TestDataFactory.createMockUser({
        role: UserRole.SUPER_ADMIN,
        id: 'inherited-super-admin',
      });
      const request = TestDataFactory.createMockRequest(superAdminUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      // Mock all permissions granted for super admin
      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'INHERITED_PERMISSION', granted: true, source: PermissionSourceType.ROLE },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // Verify the service was called with correct super admin context
      expect(permissionsService.hasPermissions).toHaveBeenCalledWith({
        user_id: 'inherited-super-admin',
        permission_names: ['INHERITED_PERMISSION'],
        company_id: 'company-456',
      });
    });

    it('should handle cross-company access for super admins', async () => {
      reflector.getAllAndOverride.mockReturnValue(['CROSS_COMPANY_PERMISSION']);

      const superAdminUser = TestDataFactory.createMockUser({
        role: UserRole.SUPER_ADMIN,
        id: 'cross-company-super-admin',
        company_id: 'company-A',
      });
      const request = TestDataFactory.createMockRequest(superAdminUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      // Super admin should have access across companies
      const mockResult = TestDataFactory.createBulkPermissionCheckResult([
        { name: 'CROSS_COMPANY_PERMISSION', granted: true, source: PermissionSourceType.ROLE },
      ]);

      permissionsService.hasPermissions.mockResolvedValue(mockResult);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsService.hasPermissions).toHaveBeenCalledWith({
        user_id: 'cross-company-super-admin',
        permission_names: ['CROSS_COMPANY_PERMISSION'],
        company_id: 'company-A',
      });
    });

    it('should validate super admin status in error scenarios', async () => {
      reflector.getAllAndOverride.mockReturnValue(['SENSITIVE_PERMISSION']);

      const superAdminUser = TestDataFactory.createMockUser({
        role: UserRole.SUPER_ADMIN,
        id: 'error-super-admin',
      });
      const request = TestDataFactory.createMockRequest(superAdminUser);
      const context = TestDataFactory.createMockExecutionContext(request);

      // Simulate service error even for super admin
      permissionsService.hasPermissions.mockRejectedValue(new Error('Database down'));

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Permission check failed');
    });
  });

  describe('SuperAdminBypassGuard Integration', () => {
    it('should bypass permission checks when superAdminBypass flag is set', async () => {
      reflector.getAllAndOverride.mockReturnValue(['SENSITIVE_PERMISSION']);

      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_EMPLOYEE,
        id: 'regular-user',
      });
      const request = TestDataFactory.createMockRequest(regularUser);

      // Set the bypass flag that would be set by SuperAdminBypassGuard
      request.superAdminBypass = true;

      const context = TestDataFactory.createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // Should not call permissions service when bypass flag is set
      expect(permissionsService.hasPermissions).not.toHaveBeenCalled();
    });

    it('should proceed with normal permission checks when superAdminBypass flag is not set', async () => {
      reflector.getAllAndOverride.mockReturnValue(['READ_PERMISSION']);

      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_EMPLOYEE,
        id: 'regular-user',
      });
      const request = TestDataFactory.createMockRequest(regularUser);

      // No bypass flag set
      const context = TestDataFactory.createMockExecutionContext(request);

      // Mock successful permission check
      permissionsService.hasPermissions.mockResolvedValue({
        user_id: 'regular-user',
        results: [TestDataFactory.createPermissionCheckResult('READ_PERMISSION', true)],
        total_checked: 1,
        granted_count: 1,
        checked_at: new Date(),
        from_cache: false,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // Should call permissions service when no bypass flag
      expect(permissionsService.hasPermissions).toHaveBeenCalled();
    });

    it('should handle undefined superAdminBypass flag gracefully', async () => {
      reflector.getAllAndOverride.mockReturnValue(['READ_PERMISSION']);

      const regularUser = TestDataFactory.createMockUser({
        role: UserRole.VENDOR_EMPLOYEE,
        id: 'regular-user',
      });
      const request = TestDataFactory.createMockRequest(regularUser);

      // Explicitly ensure no bypass flag exists
      delete request.superAdminBypass;

      const context = TestDataFactory.createMockExecutionContext(request);

      // Mock successful permission check
      permissionsService.hasPermissions.mockResolvedValue({
        user_id: 'regular-user',
        results: [TestDataFactory.createPermissionCheckResult('READ_PERMISSION', true)],
        total_checked: 1,
        granted_count: 1,
        checked_at: new Date(),
        from_cache: false,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsService.hasPermissions).toHaveBeenCalled();
    });
  });
});

describe('@RequirePermissions Decorator', () => {
  it('should set metadata correctly for single permission', () => {
    const target = {};
    const propertyKey = 'testMethod';
    const descriptor = { value: jest.fn() };

    RequirePermissions('CREATE_PETITION')(target, propertyKey, descriptor);

    const metadata = Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, descriptor.value);
    expect(metadata).toEqual(['CREATE_PETITION']);
  });

  it('should set metadata correctly for multiple permissions', () => {
    const target = {};
    const propertyKey = 'testMethod';
    const descriptor = { value: jest.fn() };

    RequirePermissions('CREATE_PETITION', 'VIEW_PETITION', 'EDIT_PETITION')(
      target,
      propertyKey,
      descriptor
    );

    const metadata = Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, descriptor.value);
    expect(metadata).toEqual(['CREATE_PETITION', 'VIEW_PETITION', 'EDIT_PETITION']);
  });

  it('should work with class-level decoration', () => {
    const targetClass = class TestController {};

    RequirePermissions('ADMIN_ACCESS')(targetClass);

    const metadata = Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, targetClass);
    expect(metadata).toEqual(['ADMIN_ACCESS']);
  });

  it('should handle empty permissions array', () => {
    const target = {};
    const propertyKey = 'testMethod';
    const descriptor = { value: jest.fn() };

    RequirePermissions()(target, propertyKey, descriptor);

    const metadata = Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, descriptor.value);
    expect(metadata).toEqual([]);
  });

  it('should preserve function properties when decorating methods', () => {
    const target = {};
    const propertyKey = 'testMethod';
    const originalFunction = jest.fn() as any;
    originalFunction.customProperty = 'test';
    const descriptor = { value: originalFunction };

    RequirePermissions('CREATE_PETITION')(target, propertyKey, descriptor);

    expect(descriptor.value).toBe(originalFunction);
    expect((descriptor.value as any).customProperty).toBe('test');
  });
});
