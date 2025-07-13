import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { RoleService } from './role.service';
import { User, UserRole } from '../auth/entities/user.entity';

describe('RoleService', () => {
  let service: RoleService;
  let userModel: jest.Mocked<typeof User>;

  const mockRole = {
    id: 'role-123',
    name: 'Team Member',
    code: 'team_member',
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    role_id: 'role-123',
    role: mockRole,
    company_id: 'company-123',
    auth0_user_id: 'auth0|123',
    is_lawyer: false,
    status: 'active',
    hasRoleEnum: jest.fn().mockReturnValue(true),
    roleEnum: UserRole.TEAM_MEMBER,
  } as unknown as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        {
          provide: getModelToken(User),
          useValue: {
            findByPk: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
    userModel = module.get(getModelToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserRole', () => {
    it('should return user with role information', async () => {
      userModel.findByPk.mockResolvedValue(mockUser);

      const result = await service.getUserRole('user-123');

      expect(userModel.findByPk).toHaveBeenCalledWith('user-123', {
        attributes: ['id', 'email', 'first_name', 'last_name', 'role_id', 'company_id'],
        include: [
          {
            association: 'role',
            attributes: ['id', 'name', 'code', 'description'],
          },
        ],
      });
      expect(result).toBe(mockUser);
    });

    it('should return null when user not found', async () => {
      userModel.findByPk.mockResolvedValue(null);

      const result = await service.getUserRole('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      userModel.findByPk.mockRejectedValue(dbError);

      await expect(service.getUserRole('user-123')).rejects.toThrow('Database connection failed');
    });

    it('should only return specific attributes for security', async () => {
      userModel.findByPk.mockResolvedValue(mockUser);

      await service.getUserRole('user-123');

      expect(userModel.findByPk).toHaveBeenCalledWith('user-123', {
        attributes: ['id', 'email', 'first_name', 'last_name', 'role_id', 'company_id'],
        include: [
          {
            association: 'role',
            attributes: ['id', 'name', 'code', 'description'],
          },
        ],
      });
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      userModel.update.mockResolvedValue([1]);

      await service.updateUserRole('user-123', 'role-456');

      expect(userModel.update).toHaveBeenCalledWith(
        { role_id: 'role-456' },
        { where: { id: 'user-123' } }
      );
    });

    it('should handle database errors during update', async () => {
      const dbError = new Error('Database update failed');
      userModel.update.mockRejectedValue(dbError);

      await expect(service.updateUserRole('user-123', 'role-456')).rejects.toThrow(
        'Database update failed'
      );
    });

    it('should accept all valid role ID values', async () => {
      userModel.update.mockResolvedValue([1]);

      const validRoleIds = [
        'vendor-admin-role-id',
        'team-member-role-id',
        'national-niner-admin-role-id',
        'national-niner-employee-role-id',
        'client-role-id',
      ];

      for (const roleId of validRoleIds) {
        await service.updateUserRole('user-123', roleId);
        expect(userModel.update).toHaveBeenCalledWith(
          { role_id: roleId },
          { where: { id: 'user-123' } }
        );
      }

      expect(userModel.update).toHaveBeenCalledTimes(validRoleIds.length);
    });

    it('should handle case where no rows are updated', async () => {
      userModel.update.mockResolvedValue([0]); // No rows affected

      await expect(service.updateUserRole('nonexistent', 'role-456')).resolves.not.toThrow();
    });
  });

  describe('error logging', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log errors in getUserRole', async () => {
      const dbError = new Error('Database error');
      userModel.findByPk.mockRejectedValue(dbError);

      try {
        await service.getUserRole('user-123');
      } catch (error) {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith('Error getting user role:', dbError);
    });

    it('should log errors in updateUserRole', async () => {
      const dbError = new Error('Update error');
      userModel.update.mockRejectedValue(dbError);

      try {
        await service.updateUserRole('user-123', 'role-456');
      } catch (error) {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith('Error updating user role:', dbError);
    });
  });
});
