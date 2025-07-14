import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { Company } from '../company/entities/company.entity';
import { Role } from '../role/entities/role.entity';
import { PermissionSourceType } from '../role/dto/permissions-service.dto';
import { PermissionsService } from '../role/permissions.service';
import { AuthService } from './auth.service';
import { AcmeInviteDto } from './dto/acme-invite.dto';
import { VendorInviteDto, VendorRole } from './dto/vendor-invite.dto';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let userModel: any;
  let companyModel: any;
  let permissionsService: jest.Mocked<PermissionsService>;
  let authService: jest.Mocked<AuthService>;
  let sequelize: any;

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
    status: UserStatus.ACTIVE,
    first_name: 'Test',
    last_name: 'User',
    auth0_user_id: 'auth0|123',
    is_lawyer: false,
    hasRoleEnum: jest.fn().mockReturnValue(true),
    roleEnum: UserRole.TEAM_MEMBER,
  } as unknown as User;

  const mockCompany = {
    id: 'company-123',
    name: 'Test Company',
    type: 'VENDOR',
  } as Company;

  // Create a robust mock user instance that mimics Sequelize model behavior
  const createMockUserInstance = (data: any) => {
    // Define the core data, ensuring defaults are handled correctly
    const instanceData = {
      ...data, // Spread incoming data first
      id: data.id || `generated-id-${Math.random()}`, // Apply default ID
    };

    // Create a mock instance object that mimics real Sequelize instance behavior
    const mockInstance = {
      ...instanceData, // Allow direct property access (e.g., result.auth0_user_id)

      // Mock common Sequelize methods
      save: jest.fn().mockImplementation(() => Promise.resolve(mockInstance)),
      reload: jest.fn().mockImplementation(() => Promise.resolve(mockInstance)),
      update: jest.fn().mockImplementation((updateData) => {
        Object.assign(instanceData, updateData);
        Object.assign(mockInstance, updateData);
        return Promise.resolve(mockInstance);
      }),
      destroy: jest.fn().mockResolvedValue(undefined),

      // .toJSON() - Often called automatically by frameworks like NestJS for responses
      toJSON: jest.fn().mockReturnValue(instanceData),

      // .get({ plain: true }) - Common in Sequelize
      get: jest.fn().mockImplementation((options?: { plain?: boolean }) => {
        // If called with .get({ plain: true }), return the raw data object
        if (options?.plain) {
          return instanceData;
        }
        // Otherwise, return the full mock instance itself
        return mockInstance;
      }),
    };

    return mockInstance;
  };

  beforeEach(async () => {
    const mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User),
          useValue: {
            findOne: jest.fn(),
            findByPk: jest.fn(),
            create: jest.fn().mockImplementation((data, options) => {
              return Promise.resolve(createMockUserInstance(data));
            }),
            update: jest.fn(),
            findAll: jest.fn(),
          },
        },
        {
          provide: getModelToken(Company),
          useValue: {
            findByPk: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getModelToken(Role),
          useValue: {
            findOne: jest.fn().mockImplementation((options) => {
              const code = options.where?.code;
              const roleMap = {
                acme_admin: {
                  id: 'role-nna',
                  name: 'Acme Admin',
                  code: 'acme_admin',
                },
                vendor_employee: {
                  id: 'role-ve',
                  name: 'Vendor Employee',
                  code: 'vendor_employee',
                },
                vendor_admin: { id: 'role-va', name: 'Vendor Admin', code: 'vendor_admin' },
                client: { id: 'role-client', name: 'Client', code: 'client' },
                super_admin: { id: 'role-sa', name: 'Super Admin', code: 'super_admin' },
                team_member: { id: 'role-tm', name: 'Team Member', code: 'team_member' },
                acme_manager: {
                  id: 'role-nnm',
                  name: 'Acme Manager',
                  code: 'acme_manager',
                },
                acme_employee: {
                  id: 'role-nne',
                  name: 'Acme Employee',
                  code: 'acme_employee',
                },
                vendor_manager: { id: 'role-vm', name: 'Vendor Manager', code: 'vendor_manager' },
              };
              return Promise.resolve(roleMap[code] || null);
            }),
            findAll: jest.fn(),
          },
        },
        {
          provide: PermissionsService,
          useValue: {
            getUserPermissions: jest.fn(),
            getEffectivePermissionsForUser: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            createAuth0User: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
        {
          provide: getConnectionToken(),
          useValue: {
            transaction: jest.fn().mockImplementation((callback) => callback(mockTransaction)),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userModel = module.get(getModelToken(User));
    companyModel = module.get(getModelToken(Company));
    permissionsService = module.get(PermissionsService);
    authService = module.get(AuthService);
    sequelize = module.get(getConnectionToken());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('acmeInvite', () => {
    const inviteDto: AcmeInviteDto = {
      email: 'admin@acme.com',
      role: UserRole.ACME_ADMIN,
      first_name: 'John',
      last_name: 'Doe',
      is_lawyer: false,
    };

    it('should create Acme user successfully', async () => {
      const acmeCompany = { id: 'acme-company-id', name: 'Acme' } as Company;
      // Note: createdUser is not used in assertions, only for setup

      companyModel.findOne.mockResolvedValue(acmeCompany);
      userModel.findOne.mockResolvedValue(null);
      // Remove the manual mock override - let the implementation mock handle it
      authService.createAuth0User.mockResolvedValue({ user_id: 'auth0|123' });
      authService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.acmeInvite(inviteDto, 'inviter-123');

      expect(companyModel.findOne).toHaveBeenCalledWith({
        where: { name: 'Acme' },
      });
      expect(userModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auth0_user_id: 'auth0|123',
          email: inviteDto.email,
          role_id: expect.any(String),
          company_id: 'acme-company-id',
          first_name: inviteDto.first_name,
          last_name: inviteDto.last_name,
        }),
        { transaction: expect.any(Object) }
      );
      expect(authService.createAuth0User).toHaveBeenCalled();
      expect(authService.sendPasswordResetEmail).toHaveBeenCalled();
      expect(result.email).toBe(inviteDto.email);
      expect(result.company_id).toBe('acme-company-id');
      expect(result.auth0_user_id).toBe('auth0|123');
    });

    it('should throw ConflictException if user already exists', async () => {
      const acmeCompany = { id: 'acme-company-id' } as Company;

      companyModel.findOne.mockResolvedValue(acmeCompany);
      userModel.findOne.mockResolvedValue(mockUser);

      await expect(service.acmeInvite(inviteDto, 'inviter-123')).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if Acme company not found', async () => {
      companyModel.findOne.mockResolvedValue(null);

      await expect(service.acmeInvite(inviteDto, 'inviter-123')).rejects.toThrow(
        UnprocessableEntityException
      );
    });
  });

  describe('vendorInvite', () => {
    const inviteDto: VendorInviteDto = {
      email: 'vendor@company.com',
      role: VendorRole.VENDOR_EMPLOYEE,
      first_name: 'Jane',
      last_name: 'Smith',
      is_lawyer: false,
    };

    const invitingUser = {
      id: 'admin-123',
      role_id: 'admin-role-id',
      company_id: 'company-123',
      email: 'admin@test.com',
      first_name: 'Admin',
      last_name: 'User',
      auth0_user_id: 'auth0|admin',
      is_lawyer: false,
      status: 'active',
      hasRoleEnum: jest.fn().mockReturnValue(true),
      roleEnum: UserRole.VENDOR_ADMIN,
    } as unknown as User;

    it('should create vendor user successfully', async () => {
      // Note: createdUser is not used in assertions, only for setup

      companyModel.findByPk.mockResolvedValue(mockCompany);
      userModel.findOne.mockResolvedValue(null);
      // Remove the manual mock override - let the implementation mock handle it
      authService.createAuth0User.mockResolvedValue({ user_id: 'auth0|456' });
      authService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.vendorInvite(inviteDto, invitingUser);

      // Company validation is done differently in vendorInvite (uses inviter's company_id)
      // No need to test findByPk since it uses the inviter's company_id directly
      expect(userModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auth0_user_id: 'auth0|456',
          email: inviteDto.email,
          role_id: expect.any(String),
          company_id: 'company-123',
          first_name: inviteDto.first_name,
          last_name: inviteDto.last_name,
        }),
        { transaction: expect.any(Object) }
      );
      expect(result.email).toBe(inviteDto.email);
      expect(result.company_id).toBe('company-123');
      expect(result.auth0_user_id).toBe('auth0|456');
    });

    it('should throw UnprocessableEntityException if inviter has no company', async () => {
      const inviterWithoutCompany = {
        ...invitingUser,
        company_id: null,
      } as unknown as User;

      await expect(service.vendorInvite(inviteDto, inviterWithoutCompany)).rejects.toThrow(
        UnprocessableEntityException
      );
    });

    it('should throw ConflictException if user already exists', async () => {
      companyModel.findByPk.mockResolvedValue(mockCompany);
      userModel.findOne.mockResolvedValue(mockUser);

      await expect(service.vendorInvite(inviteDto, invitingUser)).rejects.toThrow(
        ConflictException
      );
    });

    it('should throw UnprocessableEntityException if Auth0 user creation fails', async () => {
      authService.createAuth0User.mockRejectedValue(new Error('Auth0 API Error'));

      await expect(service.vendorInvite(inviteDto, invitingUser)).rejects.toThrow(
        UnprocessableEntityException
      );
    });
  });

  describe('getOwnProfile', () => {
    it('should return user own profile with sensitive data', async () => {
      const mockCompany = {
        id: 'company-123',
        name: 'Test Company',
        type: 'VENDOR',
        status: 'ACTIVE',
        address: '123 Main St',
        email: 'test@company.com',
        phone_number: '123-456-7890',
        subdomain: 'test',
      };
      const mockRoles = [{ name: 'admin' }];
      const mockRole = {
        id: 'role-456',
        name: 'Vendor Admin',
        code: 'vendor_admin',
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        company_id: 'company-123',
        role_id: 'role-456',
        role: mockRole,
        status: UserStatus.ACTIVE,
        company: mockCompany,
      };

      userModel.findOne.mockResolvedValue(mockUser);
      permissionsService.getEffectivePermissionsForUser.mockResolvedValue({
        user_id: 'user-123',
        company_id: 'company-123',
        permissions: [
          {
            name: 'users:read',
            category: 'USER',
            source: PermissionSourceType.ROLE,
            is_active: true,
          },
          {
            name: 'users:write',
            category: 'USER',
            source: PermissionSourceType.ROLE,
            is_active: true,
          },
        ],
        permission_names: ['users:read', 'users:write'],
        calculated_at: new Date(),
        from_cache: false,
        cache_ttl_seconds: 300,
      });

      const result = await service.getOwnProfile('auth0|123');

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { auth0_user_id: 'auth0|123' },
        include: expect.any(Array),
        attributes: ['id', 'email', 'first_name', 'last_name', 'company_id', 'role_id', 'status'],
      });

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        companyName: 'Test Company',
        company: {
          id: 'company-123',
          name: 'Test Company',
          type: 'VENDOR',
          status: 'ACTIVE',
          address: '123 Main St',
          email: 'test@company.com',
          phoneNumber: '123-456-7890',
          subdomain: 'test',
        },
        role: {
          id: 'role-456',
          name: 'Vendor Admin',
          code: 'vendor_admin',
        },
        permissions: ['users:read', 'users:write'],
        auth0id: 'auth0|123',
        status: UserStatus.ACTIVE,
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(service.getOwnProfile('auth0|nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOtherUserProfile', () => {
    it('should return other user profile without sensitive data', async () => {
      const mockCompany = {
        id: 'company-123',
        name: 'Test Company',
        type: 'VENDOR',
        status: 'ACTIVE',
        address: '123 Main St',
        email: 'test@company.com',
        phone_number: '123-456-7890',
        subdomain: 'test',
      };
      const mockRole = {
        id: 'role-789',
        name: 'Vendor Employee',
        code: 'vendor_employee',
      };
      const mockUser = {
        id: 'user-456',
        email: 'other@example.com',
        first_name: 'Other',
        last_name: 'User',
        company_id: 'company-123',
        role_id: 'role-789',
        role: mockRole,
        status: UserStatus.ACTIVE,
        company: mockCompany,
      };

      userModel.findOne.mockResolvedValue(mockUser);

      const result = await service.getOtherUserProfile('user-456', 'company-123');

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: {
          id: 'user-456',
          company_id: 'company-123',
        },
        include: expect.any(Array),
        attributes: ['id', 'email', 'first_name', 'last_name', 'company_id', 'role_id', 'status'],
      });

      expect(result).toEqual({
        id: 'user-456',
        email: 'other@example.com',
        firstName: 'Other',
        lastName: 'User',
        companyName: 'Test Company',
        company: {
          id: 'company-123',
          name: 'Test Company',
          type: 'VENDOR',
          status: 'ACTIVE',
          address: '123 Main St',
          email: 'test@company.com',
          phoneNumber: '123-456-7890',
          subdomain: 'test',
        },
        role: {
          id: 'role-789',
          name: 'Vendor Employee',
          code: 'vendor_employee',
        },
        status: UserStatus.ACTIVE,
      });

      // Ensure no permissions were fetched
      expect(permissionsService.getEffectivePermissionsForUser).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found or different company', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(service.getOtherUserProfile('user-456', 'company-123')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      userModel.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-123');

      expect(userModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          include: expect.arrayContaining([
            expect.objectContaining({
              model: Company,
              as: 'company',
              attributes: ['id', 'name'],
            }),
          ]),
        })
      );
      expect(result).toBe(mockUser);
    });

    it('should return null if user not found', async () => {
      userModel.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      userModel.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: [Company],
      });
      expect(result).toBe(mockUser);
    });

    it('should return null if user not found', async () => {
      userModel.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByCompany', () => {
    it('should find all users for a company', async () => {
      const companyUsers = [mockUser];
      userModel.findAll.mockResolvedValue(companyUsers);

      const result = await service.findByCompany('company-123');

      expect(userModel.findAll).toHaveBeenCalledWith({
        where: { company_id: 'company-123' },
        include: [Company],
      });
      expect(result).toBe(companyUsers);
    });

    it('should enforce multi-tenant isolation', async () => {
      userModel.findAll.mockResolvedValue([]);

      await service.findByCompany('company-123');

      expect(userModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company_id: 'company-123',
          }),
        })
      );
    });
  });

  describe('updateStatus', () => {
    it('should update user status', async () => {
      userModel.findByPk.mockResolvedValue(mockUser);
      const updatedUser = { ...mockUser, status: UserStatus.ACTIVE };
      userModel.update.mockResolvedValue([1, [updatedUser]] as any);

      const result = await service.updateStatus('user-123', UserStatus.ACTIVE);

      expect(userModel.update).toHaveBeenCalledWith(
        { status: UserStatus.ACTIVE },
        { where: { id: 'user-123' }, returning: true }
      );
      expect(result).toBe(updatedUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findByPk.mockResolvedValue(null);

      await expect(service.updateStatus('nonexistent', UserStatus.ACTIVE)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
