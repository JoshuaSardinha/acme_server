import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { TeamValidationService, TeamCategory } from './team-validation.service';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { User } from '../../auth/entities/user.entity';
import { Company } from '../../company/entities/company.entity';

describe('TeamValidationService', () => {
  let service: TeamValidationService;
  let mockTeamModel: any;
  let mockTeamMemberModel: any;
  let mockUserModel: any;
  let mockCompanyModel: any;
  let mockSequelize: any;

  beforeEach(async () => {
    mockTeamModel = {
      findByPk: jest.fn(),
      findOne: jest.fn(),
    };

    mockTeamMemberModel = {
      findOne: jest.fn(),
      findAll: jest.fn(),
    };

    mockUserModel = {
      findByPk: jest.fn(),
      findAll: jest.fn(),
    };

    mockCompanyModel = {
      findByPk: jest.fn(),
    };

    mockSequelize = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamValidationService,
        {
          provide: getModelToken(Team),
          useValue: mockTeamModel,
        },
        {
          provide: getModelToken(TeamMember),
          useValue: mockTeamMemberModel,
        },
        {
          provide: getModelToken(User),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Company),
          useValue: mockCompanyModel,
        },
      ],
    }).compile();

    service = module.get<TeamValidationService>(TeamValidationService);
  });

  describe('validateTeamOwnerCompany', () => {
    it('should pass when manager belongs to the same company', async () => {
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-1',
        company_id: 'company-1',
      });

      await expect(service.validateTeamOwnerCompany('user-1', 'company-1')).resolves.not.toThrow();
    });

    it('should throw NotFoundException when manager does not exist', async () => {
      mockUserModel.findByPk.mockResolvedValue(null);

      await expect(service.validateTeamOwnerCompany('user-1', 'company-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when manager belongs to different company', async () => {
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-1',
        company_id: 'company-2',
      });

      await expect(service.validateTeamOwnerCompany('user-1', 'company-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('validateTeamMembersCompany', () => {
    it('should pass when all members belong to the same company', async () => {
      mockUserModel.findAll.mockResolvedValue([
        { id: 'user-1', company_id: 'company-1', first_name: 'John', last_name: 'Doe' },
        { id: 'user-2', company_id: 'company-1', first_name: 'Jane', last_name: 'Smith' },
      ]);

      await expect(
        service.validateTeamMembersCompany(['user-1', 'user-2'], 'company-1')
      ).resolves.not.toThrow();
    });

    it('should throw NotFoundException when some members do not exist', async () => {
      mockUserModel.findAll.mockResolvedValue([
        { id: 'user-1', company_id: 'company-1', first_name: 'John', last_name: 'Doe' },
      ]);

      await expect(
        service.validateTeamMembersCompany(['user-1', 'user-2'], 'company-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when some members belong to different companies', async () => {
      mockUserModel.findAll.mockResolvedValue([
        { id: 'user-1', company_id: 'company-1', first_name: 'John', last_name: 'Doe' },
        { id: 'user-2', company_id: 'company-2', first_name: 'Jane', last_name: 'Smith' },
      ]);

      await expect(
        service.validateTeamMembersCompany(['user-1', 'user-2'], 'company-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass when member list is empty', async () => {
      await expect(service.validateTeamMembersCompany([], 'company-1')).resolves.not.toThrow();
    });
  });

  describe('validateLegalTeamLawyerRequirement', () => {
    it('should pass for non-LEGAL teams', async () => {
      await expect(
        service.validateLegalTeamLawyerRequirement('team-1', TeamCategory.ADMINISTRATIVE)
      ).resolves.not.toThrow();
    });

    it('should pass when LEGAL team has lawyer manager', async () => {
      mockTeamModel.findByPk.mockResolvedValue({
        id: 'team-1',
        owner: { id: 'user-1', is_lawyer: true },
        members: [{ id: 'user-2', is_lawyer: false }],
      });

      await expect(
        service.validateLegalTeamLawyerRequirement('team-1', TeamCategory.LEGAL)
      ).resolves.not.toThrow();
    });

    it('should pass when LEGAL team has lawyer member', async () => {
      mockTeamModel.findByPk.mockResolvedValue({
        id: 'team-1',
        owner: { id: 'user-1', is_lawyer: false },
        members: [
          { id: 'user-2', is_lawyer: true },
          { id: 'user-3', is_lawyer: false },
        ],
      });

      await expect(
        service.validateLegalTeamLawyerRequirement('team-1', TeamCategory.LEGAL)
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException when LEGAL team has no lawyers', async () => {
      mockTeamModel.findByPk.mockResolvedValue({
        id: 'team-1',
        manager: { id: 'user-1', is_lawyer: false },
        members: [
          { id: 'user-2', is_lawyer: false },
          { id: 'user-3', is_lawyer: false },
        ],
      });

      await expect(
        service.validateLegalTeamLawyerRequirement('team-1', TeamCategory.LEGAL)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeamModel.findByPk.mockResolvedValue(null);

      await expect(
        service.validateLegalTeamLawyerRequirement('team-1', TeamCategory.LEGAL)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateTeamCreation', () => {
    it('should pass with valid team creation data', async () => {
      // Mock company exists
      mockCompanyModel.findByPk.mockResolvedValue({
        id: 'company-1',
        name: 'Test Company',
      });

      // Mock team name uniqueness
      mockTeamModel.findOne.mockResolvedValue(null);

      // Mock manager validation
      mockUserModel.findByPk.mockResolvedValue({
        id: 'manager-1',
        company_id: 'company-1',
      });

      // Mock members validation
      mockUserModel.findAll.mockResolvedValue([
        { id: 'user-1', company_id: 'company-1', first_name: 'John', last_name: 'Doe' },
        { id: 'user-2', company_id: 'company-1', first_name: 'Jane', last_name: 'Smith' },
      ]);

      await expect(
        service.validateTeamCreation('New Team', 'company-1', 'manager-1', ['user-1', 'user-2'])
      ).resolves.not.toThrow();
    });

    it('should throw NotFoundException when company does not exist', async () => {
      mockCompanyModel.findByPk.mockResolvedValue(null);

      await expect(
        service.validateTeamCreation('New Team', 'company-1', 'manager-1', ['user-1', 'user-2'])
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when manager is in member list', async () => {
      mockCompanyModel.findByPk.mockResolvedValue({
        id: 'company-1',
        name: 'Test Company',
      });

      mockTeamModel.findOne.mockResolvedValue(null);

      mockUserModel.findByPk.mockResolvedValue({
        id: 'manager-1',
        company_id: 'company-1',
      });

      mockUserModel.findAll.mockResolvedValue([
        { id: 'manager-1', company_id: 'company-1', first_name: 'Manager', last_name: 'User' },
        { id: 'user-2', company_id: 'company-1', first_name: 'Jane', last_name: 'Smith' },
      ]);

      await expect(
        service.validateTeamCreation('New Team', 'company-1', 'manager-1', ['manager-1', 'user-2'])
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateManagerChange', () => {
    it('should pass with valid manager change', async () => {
      mockTeamModel.findByPk.mockResolvedValue({
        id: 'team-1',
        company_id: 'company-1',
        company: { id: 'company-1' },
      });

      mockUserModel.findByPk.mockResolvedValue({
        id: 'new-manager-1',
        company_id: 'company-1',
      });

      mockTeamMemberModel.findOne.mockResolvedValue(null);

      await expect(service.validateManagerChange('team-1', 'new-manager-1')).resolves.not.toThrow();
    });

    it('should throw NotFoundException when team does not exist', async () => {
      mockTeamModel.findByPk.mockResolvedValue(null);

      await expect(service.validateManagerChange('team-1', 'new-manager-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when new manager is current member', async () => {
      mockTeamModel.findByPk.mockResolvedValue({
        id: 'team-1',
        company_id: 'company-1',
        company: { id: 'company-1' },
      });

      mockUserModel.findByPk.mockResolvedValue({
        id: 'new-manager-1',
        company_id: 'company-1',
      });

      mockTeamMemberModel.findOne.mockResolvedValue({
        team_id: 'team-1',
        user_id: 'new-manager-1',
      });

      await expect(service.validateManagerChange('team-1', 'new-manager-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
