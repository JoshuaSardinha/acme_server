import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { PermissionsService } from './permissions.service';
import {
  Role,
  Permission,
  UserRole as UserRoleEntity,
  UserPermission,
  RolePermission,
} from './entities';
import { User, UserRole } from '../auth/entities/user.entity';
import { ServicePermissionCheckDto, PermissionSourceType } from './dto/permissions-service.dto';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let userModel: jest.Mocked<typeof User>;
  let roleModel: jest.Mocked<typeof Role>;
  let permissionModel: jest.Mocked<typeof Permission>;
  let userRoleModel: jest.Mocked<typeof UserRoleEntity>;
  let userPermissionModel: jest.Mocked<typeof UserPermission>;
  let rolePermissionModel: jest.Mocked<typeof RolePermission>;
  let configService: jest.Mocked<ConfigService>;

  const mockRole = {
    id: 'role-123',
    name: 'Team Member',
    code: 'team_member',
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    company_id: 'company-123',
    role_id: 'role-123',
    role: mockRole,
    first_name: 'Test',
    last_name: 'User',
    auth0_user_id: 'auth0|123',
    is_lawyer: false,
    status: 'active',
    hasRoleEnum: jest.fn().mockReturnValue(true),
    roleEnum: UserRole.TEAM_MEMBER,
  } as unknown as User;

  const mockPermission = {
    id: 'perm-123',
    name: 'teams:read:own',
    description: 'Read own teams',
    resource: 'teams',
    action: 'read',
    scope: 'own',
  } as any;

  const mockUserRole = {
    id: 'role-123',
    name: 'Team Member',
    description: 'Basic team member role',
  } as Role;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getModelToken(User),
          useValue: {
            findByPk: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getModelToken(Role),
          useValue: {
            findAll: jest.fn(),
            findByPk: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getModelToken(Permission),
          useValue: {
            findAll: jest.fn(),
            findByPk: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getModelToken(UserRoleEntity),
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
            destroy: jest.fn(),
          },
        },
        {
          provide: getModelToken(UserPermission),
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
            destroy: jest.fn(),
          },
        },
        {
          provide: getModelToken(RolePermission),
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
            destroy: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    userModel = module.get(getModelToken(User));
    roleModel = module.get(getModelToken(Role));
    permissionModel = module.get(getModelToken(Permission));
    userRoleModel = module.get(getModelToken(UserRoleEntity));
    userPermissionModel = module.get(getModelToken(UserPermission));
    rolePermissionModel = module.get(getModelToken(RolePermission));
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hasPermission', () => {
    const permissionCheck: ServicePermissionCheckDto = {
      user_id: 'user-123',
      permission_name: 'teams:read:own',
      company_id: 'company-123',
    };

    beforeEach(() => {
      // Mock the config service to disable caching and prevent issues
      configService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'permissions.cache_enabled':
            return false; // Disable caching
          case 'permissions.cache_ttl_seconds':
            return 300;
          default:
            return undefined;
        }
      });
    });

    it('should return true when user has permission', async () => {
      // Set up user mock with role
      const userWithRole = {
        ...mockUser,
        role: { id: 'role-123', name: 'Team Member' },
      } as unknown as User;

      userModel.findByPk.mockResolvedValue(userWithRole);
      userPermissionModel.findAll.mockResolvedValue([
        { permission: mockPermission } as UserPermission,
      ]);
      userRoleModel.findAll.mockResolvedValue([]);
      rolePermissionModel.findAll.mockResolvedValue([]);

      // Mock isSuperAdmin to return false to avoid circular dependency
      jest.spyOn(service, 'isSuperAdmin').mockResolvedValue(false);

      const result = await service.hasPermission(permissionCheck);

      expect(result.granted).toBe(true);
      expect(result.source).toBe(PermissionSourceType.DIRECT);
    });

    it('should return false when user does not have permission', async () => {
      // Set up user mock with role
      const userWithRole = {
        ...mockUser,
        role: { id: 'role-123', name: 'Team Member' },
      } as unknown as User;

      userModel.findByPk.mockResolvedValue(userWithRole);
      userPermissionModel.findAll.mockResolvedValue([]);
      userRoleModel.findAll.mockResolvedValue([]);
      rolePermissionModel.findAll.mockResolvedValue([]);

      // Mock isSuperAdmin to return false to avoid circular dependency
      jest.spyOn(service, 'isSuperAdmin').mockResolvedValue(false);

      const result = await service.hasPermission(permissionCheck);

      expect(result.granted).toBe(false);
      expect(result.source).toBeUndefined();
    });

    it('should return true for super admin users', async () => {
      // Set up super admin user mock
      const superAdminUser = {
        ...mockUser,
        role: { id: 'role-sa', name: 'Super Admin' },
      } as unknown as User;

      userModel.findByPk.mockResolvedValue(superAdminUser);

      // Mock all permissions for super admin
      permissionModel.findAll.mockResolvedValue([
        { name: 'teams:read:own', category: 'TEAM' } as any,
        { name: 'users:manage:all', category: 'USER' } as any,
      ]);

      // Mock isSuperAdmin to return true
      jest.spyOn(service, 'isSuperAdmin').mockResolvedValue(true);

      const result = await service.hasPermission(permissionCheck);

      expect(result.granted).toBe(true);
    });
  });

  describe('getUserEffectivePermissions', () => {
    beforeEach(() => {
      // Mock the config service to disable caching and prevent issues
      configService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'permissions.cache_enabled':
            return false; // Disable caching
          case 'permissions.cache_ttl_seconds':
            return 300;
          default:
            return undefined;
        }
      });
    });

    it('should return all effective permissions for user', async () => {
      // Set up user mock with role
      const userWithRole = {
        ...mockUser,
        role: { id: 'role-123', name: 'Team Member' },
      } as unknown as User;

      userModel.findByPk.mockResolvedValue(userWithRole);
      userPermissionModel.findAll.mockResolvedValue([
        { permission: mockPermission } as UserPermission,
      ]);
      userRoleModel.findAll.mockResolvedValue([]);
      rolePermissionModel.findAll.mockResolvedValue([]);

      // Mock isSuperAdmin to return false to avoid circular dependency
      jest.spyOn(service, 'isSuperAdmin').mockResolvedValue(false);

      const result = await service.getEffectivePermissionsForUser('user-123', 'company-123');

      expect(result.permissions).toHaveLength(1);
      expect(result.permissions[0].name).toBe('teams:read:own');
      expect(result.from_cache).toBe(false);
    });

    it('should return all permissions for super admin users', async () => {
      // Set up super admin user mock
      const superAdminUser = {
        ...mockUser,
        role: { id: 'role-sa', name: 'Super Admin' },
      } as unknown as User;

      userModel.findByPk.mockResolvedValue(superAdminUser);

      // Mock all permissions for super admin
      permissionModel.findAll.mockResolvedValue([
        mockPermission,
        { id: 'perm-456', name: 'users:manage:all', description: 'Manage all users' },
      ]);

      // Mock isSuperAdmin to return true
      jest.spyOn(service, 'isSuperAdmin').mockResolvedValue(true);

      const result = await service.getEffectivePermissionsForUser('user-123', 'company-123');

      expect(result.permissions.length).toBeGreaterThan(0);
      expect(result.from_cache).toBe(false);
    });
  });

  describe('isSuperAdmin', () => {
    it('should return true for users with Super Admin role', async () => {
      const superAdminUser = {
        ...mockUser,
        role: { id: 'role-sa', name: 'Super Admin' },
      } as unknown as User;

      userModel.findByPk.mockResolvedValue(superAdminUser);

      const result = await service.isSuperAdmin('user-123', 'company-123');

      expect(result).toBe(true);
    });

    it('should return false for regular users', async () => {
      const regularUser = {
        ...mockUser,
        role: { id: 'role-123', name: 'Team Member' },
      } as unknown as User;

      userModel.findByPk.mockResolvedValue(regularUser);

      // Mock hasPermission to avoid circular dependency
      jest.spyOn(service, 'hasPermission').mockResolvedValue({
        granted: false,
        permission_name: 'super_admin.bypass_company_restrictions',
        user_id: 'user-123',
        checked_at: new Date(),
        from_cache: false,
      });

      const result = await service.isSuperAdmin('user-123', 'company-123');

      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      userModel.findByPk.mockResolvedValue(null);

      const result = await service.isSuperAdmin('nonexistent', 'company-123');

      expect(result).toBe(false);
    });
  });
});
