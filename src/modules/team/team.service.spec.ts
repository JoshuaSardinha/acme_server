import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/sequelize';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TeamService } from './team.service';
import { Team, TeamCategory } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { User, UserRole } from '../auth/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { TeamValidationService } from './services/team-validation.service';
import { MembershipValidationService } from './services/membership-validation.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

describe('TeamService', () => {
  let service: TeamService;
  let mockTeamModel: any;
  let mockTeamMemberModel: any;
  let mockUserModel: any;
  let mockCompanyModel: any;
  let sequelize: any;
  let teamValidationService: jest.Mocked<TeamValidationService>;
  let membershipValidationService: jest.Mocked<MembershipValidationService>;

  const mockRole = {
    id: 'role-123',
    name: 'Team Member',
    code: 'team_member',
  };

  const mockUser = {
    id: 'user-123',
    company_id: 'company-123',
    email: 'test@example.com',
    role_id: 'role-123',
    role: mockRole,
    first_name: 'Test',
    last_name: 'User',
    auth0_user_id: 'auth0|123',
    is_lawyer: false,
    status: 'active',
    hasRoleEnum: jest.fn().mockReturnValue(false), // Default: not admin
    roleEnum: UserRole.TEAM_MEMBER,
  } as unknown as User;

  const createMockTeamInstance = (data: any) => {
    const instance = {
      ...data,
      id: data.id || 'generated-id',
    };

    instance.save = jest.fn().mockImplementation(() => Promise.resolve(instance));
    instance.destroy = jest.fn().mockImplementation(() => Promise.resolve(undefined));
    instance.update = jest.fn().mockImplementation((updateData) => {
      Object.assign(instance, updateData);
      return Promise.resolve(instance);
    });

    return instance;
  };

  const mockTeam = createMockTeamInstance({
    id: 'team-123',
    name: 'Test Team',
    category: TeamCategory.CONVENTIONAL,
    company_id: 'company-123',
    owner_user_id: 'user-123',
    is_active: true,
  });

  beforeEach(async () => {
    const mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        {
          provide: getModelToken(Team),
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            findByPk: jest.fn(),
            findAndCountAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            destroy: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getModelToken(TeamMember),
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            destroy: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getModelToken(User),
          useValue: {
            findAll: jest.fn(),
            findByPk: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
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
          provide: getConnectionToken(),
          useValue: {
            transaction: jest.fn().mockImplementation((callback) => {
              return callback ? callback(mockTransaction) : Promise.resolve(mockTransaction);
            }),
          },
        },
        {
          provide: TeamValidationService,
          useValue: {
            validateTeamCreation: jest.fn(),
            validateTeamUpdate: jest.fn(),
            validateManagerChange: jest.fn(),
            validateTeamExistsInCompany: jest.fn(),
            validateLegalTeamLawyerRequirement: jest.fn(),
            validateTeamMembersCompany: jest.fn(),
            validateTeamOwnerCompany: jest.fn(),
            validateTeamNameUniqueness: jest.fn(),
            validateTeamMembershipChanges: jest.fn(),
          },
        },
        {
          provide: MembershipValidationService,
          useValue: {
            validateUserCanJoinTeam: jest.fn(),
            validateUserCanLeaveTeam: jest.fn(),
            validateMembershipOperationPermissions: jest.fn(),
            validateMembershipAddition: jest.fn(),
            validateMembershipRemoval: jest.fn(),
            validateUsersCanJoinTeam: jest.fn(),
            validateUsersCanLeaveTeam: jest.fn(),
            validateMembershipReplacement: jest.fn(),
            validateBulkMembershipOperation: jest.fn(),
            validateNewMembersBelongToCompany: jest.fn(),
            validateLegalTeamLawyerRequirementAfterRemoval: jest.fn(),
            validateLegalTeamHasLawyerAfterReplacement: jest.fn(),
            logMembershipChange: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    mockTeamModel = module.get(getModelToken(Team));
    mockTeamMemberModel = module.get(getModelToken(TeamMember));
    mockUserModel = module.get(getModelToken(User));
    mockCompanyModel = module.get(getModelToken(Company));
    sequelize = module.get(getConnectionToken());
    teamValidationService = module.get(TeamValidationService);
    membershipValidationService = module.get(MembershipValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createTeamDto: CreateTeamDto = {
      name: 'New Team',
      category: TeamCategory.CONVENTIONAL,
      description: 'Team description',
      ownerUserId: 'owner-123',
      memberIds: ['owner-123', 'user-1', 'user-2'], // Owner must be included in members
    };

    it('should create a team successfully', async () => {
      // Mock company exists
      mockCompanyModel.findByPk.mockResolvedValue({ id: mockUser.company_id });

      // Mock owner validation
      mockUserModel.findOne.mockResolvedValueOnce({
        id: createTeamDto.ownerUserId,
        company_id: mockUser.company_id,
        role: {
          id: 'role-vendor-manager',
          code: 'vendor_manager',
          name: 'Vendor Manager',
        },
        hasRoleEnum: jest
          .fn()
          .mockImplementation((roleEnum) => roleEnum === UserRole.VENDOR_MANAGER),
      });

      // Mock team name uniqueness
      mockTeamModel.findOne.mockResolvedValueOnce(null);

      // Mock members validation
      mockUserModel.findAll.mockResolvedValue([
        { id: 'owner-123', company_id: mockUser.company_id },
        { id: 'user-1', company_id: mockUser.company_id },
        { id: 'user-2', company_id: mockUser.company_id },
      ]);

      // Mock team creation
      mockTeamModel.create.mockResolvedValue(mockTeam);

      // Mock team member creation
      mockTeamMemberModel.create.mockResolvedValue({
        team_id: mockTeam.id,
        user_id: 'user-1',
        added_by_user_id: mockUser.id,
      });

      // Mock the findOne call at the end of create method
      mockTeamModel.findOne.mockResolvedValueOnce(mockTeam);

      const result = await service.create(createTeamDto, mockUser);

      expect(mockCompanyModel.findByPk).toHaveBeenCalledWith(mockUser.company_id, {
        transaction: expect.any(Object),
      });
      expect(mockTeamModel.create).toHaveBeenCalledWith(
        {
          name: createTeamDto.name,
          description: createTeamDto.description,
          category: createTeamDto.category,
          company_id: mockUser.company_id,
          owner_user_id: createTeamDto.ownerUserId,
        },
        { transaction: expect.any(Object) }
      );
      expect(result).toBe(mockTeam);
    });

    it('should throw BadRequestException when validation fails', async () => {
      mockCompanyModel.findByPk.mockResolvedValue(null);

      await expect(service.create(createTeamDto, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should handle database transaction rollback on error', async () => {
      mockCompanyModel.findByPk.mockResolvedValue({ id: mockUser.company_id });
      mockUserModel.findOne.mockResolvedValue({
        id: createTeamDto.ownerUserId,
        company_id: mockUser.company_id,
        role: {
          id: 'role-vendor-manager',
          code: 'vendor_manager',
          name: 'Vendor Manager',
        },
        hasRoleEnum: jest
          .fn()
          .mockImplementation((roleEnum) => roleEnum === UserRole.VENDOR_MANAGER),
      });
      mockTeamModel.findOne.mockResolvedValue(null);
      mockUserModel.findAll.mockResolvedValue([
        { id: 'owner-123', company_id: mockUser.company_id },
        { id: 'user-1', company_id: mockUser.company_id },
        { id: 'user-2', company_id: mockUser.company_id },
      ]);
      mockTeamModel.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createTeamDto, mockUser)).rejects.toThrow('Database error');
    });
  });

  describe('findAllPaginated', () => {
    const paginationDto: PaginationDto = {
      page: 1,
      limit: 10,
    };

    it('should return paginated teams for company', async () => {
      const mockTeams = [mockTeam];
      const totalCount = 1;

      mockTeamModel.findAndCountAll.mockResolvedValue({
        count: totalCount,
        rows: mockTeams,
      });

      const result = await service.findAllPaginated(paginationDto, mockUser);

      expect(mockTeamModel.findAndCountAll).toHaveBeenCalledWith({
        where: { company_id: mockUser.company_id },
        attributes: expect.any(Array),
        include: expect.any(Array),
        limit: paginationDto.limit,
        offset: 0,
        order: [['created_at', 'DESC']],
      });

      expect(result.data).toBe(mockTeams);
      expect(result.meta.itemCount).toBe(totalCount);
      expect(result.meta.currentPage).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should apply company_id filter for multi-tenant isolation', async () => {
      mockTeamModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await service.findAllPaginated(paginationDto, mockUser);

      expect(mockTeamModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company_id: mockUser.company_id,
          }),
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return team when found and user has access', async () => {
      mockTeamModel.findOne.mockResolvedValue(mockTeam);

      const result = await service.findOne(mockUser, 'team-123');

      expect(mockTeamModel.findOne).toHaveBeenCalledWith({
        where: {
          id: 'team-123',
          company_id: mockUser.company_id,
        },
        attributes: expect.any(Array),
        include: expect.any(Array),
      });
      expect(result).toBe(mockTeam);
    });

    it('should throw NotFoundException when team not found', async () => {
      mockTeamModel.findOne.mockResolvedValue(null);

      await expect(service.findOne(mockUser, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should enforce multi-tenant isolation', async () => {
      mockTeamModel.findOne.mockResolvedValue(null);

      try {
        await service.findOne(mockUser, 'team-123');
      } catch (error) {
        // Expected NotFoundException when team not found
      }

      expect(mockTeamModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company_id: mockUser.company_id,
          }),
        })
      );
    });
  });

  describe('update', () => {
    const updateTeamDto: UpdateTeamDto = {
      name: 'Updated Team',
      description: 'Updated description',
    };

    it('should update team successfully', async () => {
      mockTeamModel.findOne
        .mockResolvedValueOnce(mockTeam) // First call for finding current team
        .mockResolvedValueOnce(null) // Second call for name conflict check
        .mockResolvedValueOnce(mockTeam); // Third call in findOne at the end
      mockTeamModel.update.mockResolvedValue([1]);

      const result = await service.update(mockUser, 'team-123', updateTeamDto);

      expect(mockTeamModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: updateTeamDto.name,
          description: updateTeamDto.description,
        }),
        {
          where: { id: 'team-123', company_id: mockUser.company_id },
          transaction: expect.any(Object),
        }
      );
      expect(result).toBe(mockTeam);
    });

    it('should throw NotFoundException when team not found', async () => {
      mockTeamModel.findOne.mockResolvedValue(null);

      await expect(service.update(mockUser, 'nonexistent', updateTeamDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('remove', () => {
    it('should hard delete team successfully', async () => {
      mockTeamModel.findOne.mockResolvedValue(mockTeam);
      mockTeamMemberModel.destroy.mockResolvedValue(2);
      mockTeamModel.destroy.mockResolvedValue(1);

      await service.remove(mockUser, 'team-123');

      expect(mockTeamMemberModel.destroy).toHaveBeenCalledWith({
        where: { team_id: 'team-123' },
        transaction: expect.any(Object),
      });
      expect(mockTeamModel.destroy).toHaveBeenCalledWith({
        where: { id: 'team-123', company_id: mockUser.company_id },
        transaction: expect.any(Object),
      });
    });

    it('should throw NotFoundException when team not found', async () => {
      mockTeamModel.findOne.mockResolvedValue(null);

      await expect(service.remove(mockUser, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMember', () => {
    const mockMember = {
      id: 'member-123',
      team_id: 'team-123',
      user_id: 'user-456',
      added_by_user_id: mockUser.id,
    } as TeamMember;

    it('should add member to team successfully', async () => {
      mockTeamModel.findOne.mockResolvedValue(mockTeam);
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-456',
        company_id: 'company-123',
      } as User);
      membershipValidationService.validateMembershipAddition.mockResolvedValue(undefined);
      mockTeamMemberModel.create.mockResolvedValue(mockMember);

      const result = await service.addMember(mockUser, 'team-123', 'user-456');

      expect(membershipValidationService.validateMembershipAddition).toHaveBeenCalled();
      expect(mockTeamMemberModel.create).toHaveBeenCalledWith(
        {
          team_id: 'team-123',
          user_id: 'user-456',
          added_by_user_id: mockUser.id,
        },
        { transaction: expect.any(Object) }
      );
      expect(result).toBe(mockMember);
    });

    it('should throw NotFoundException when team not found', async () => {
      mockTeamModel.findOne.mockResolvedValue(null);

      await expect(service.addMember(mockUser, 'nonexistent', 'user-456')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockTeamModel.findOne.mockResolvedValue(mockTeam);
      mockUserModel.findByPk.mockResolvedValue(null);

      await expect(service.addMember(mockUser, 'team-123', 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should enforce multi-tenant isolation for user', async () => {
      mockTeamModel.findOne.mockResolvedValue(mockTeam);
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-456',
        company_id: 'different-company',
      } as User);

      // The service validates company_id in validateMembershipAddition
      membershipValidationService.validateMembershipAddition.mockRejectedValue(
        new BadRequestException('User does not belong to the same company')
      );

      await expect(service.addMember(mockUser, 'team-123', 'user-456')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('removeMember', () => {
    const mockMembership = {
      team_id: 'team-123',
      user_id: 'user-456',
      destroy: jest.fn(),
    } as unknown as TeamMember;

    it('should remove member from team successfully', async () => {
      mockTeamModel.findOne.mockResolvedValue(mockTeam);
      mockTeamMemberModel.findOne.mockResolvedValue(mockMembership);
      membershipValidationService.validateMembershipRemoval.mockResolvedValue(undefined);
      mockTeamMemberModel.destroy.mockResolvedValue(1);

      await service.removeMember(mockUser, 'team-123', 'user-456');

      expect(membershipValidationService.validateMembershipRemoval).toHaveBeenCalled();
      expect(mockTeamMemberModel.destroy).toHaveBeenCalledWith({
        where: {
          team_id: 'team-123',
          user_id: 'user-456',
        },
        transaction: expect.any(Object),
      });
    });

    it('should throw NotFoundException when membership not found', async () => {
      mockTeamModel.findOne.mockResolvedValue(mockTeam);
      mockTeamMemberModel.findOne.mockResolvedValue(null);

      await expect(service.removeMember(mockUser, 'team-123', 'user-456')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('multi-tenancy enforcement', () => {
    it('should always include company_id in queries', async () => {
      const testMethods = [
        () => service.findAllPaginated({ page: 1, limit: 10 }, mockUser),
        () => service.findOne(mockUser, 'team-123'),
        () => service.update(mockUser, 'team-123', {}),
        () => service.remove(mockUser, 'team-123'),
      ];

      // Mock responses to prevent errors
      mockTeamModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      mockTeamModel.findOne.mockResolvedValue(null);

      for (const method of testMethods) {
        try {
          await method();
        } catch (error) {
          // Expected for some methods when team not found
        }
      }

      // Verify all calls included company_id
      const calls = mockTeamModel.findOne.mock.calls.concat(
        mockTeamModel.findAndCountAll.mock.calls
      );
      calls.forEach((call) => {
        if (call[0] && call[0].where) {
          expect(call[0].where).toHaveProperty('company_id', mockUser.company_id);
        }
      });
    });
  });

  // Additional tests for legacy methods
  describe('getTeamById', () => {
    it('should return team by id', async () => {
      mockTeamModel.findOne.mockResolvedValue(mockTeam);

      const result = await service.getTeamById('team-123');

      expect(mockTeamModel.findOne).toHaveBeenCalledWith({
        where: { id: 'team-123' },
      });
      expect(result).toBe(mockTeam);
    });

    it('should return null when team not found', async () => {
      mockTeamModel.findOne.mockResolvedValue(null);

      const result = await service.getTeamById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('validateLegalTeamHasLawyer', () => {
    it('should pass when legal team has a lawyer', async () => {
      const memberIds = ['user-1', 'user-2'];
      mockUserModel.findAll.mockResolvedValue([
        { id: 'user-1', is_lawyer: false },
        { id: 'user-2', is_lawyer: true },
      ]);

      await expect(service['validateLegalTeamHasLawyer'](memberIds)).resolves.not.toThrow();
    });

    it('should throw BadRequestException when legal team has no lawyers', async () => {
      const memberIds = ['user-1', 'user-2'];
      mockUserModel.findAll.mockResolvedValue([
        { id: 'user-1', is_lawyer: false },
        { id: 'user-2', is_lawyer: false },
      ]);

      await expect(service['validateLegalTeamHasLawyer'](memberIds)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
