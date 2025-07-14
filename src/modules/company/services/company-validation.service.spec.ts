import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { CompanyValidationService } from './company-validation.service';
import { Company } from '../entities/company.entity';
import { User } from '../../auth/entities/user.entity';
import { Team } from '../../team/entities/team.entity';

describe('CompanyValidationService', () => {
  let service: CompanyValidationService;
  let mockCompanyModel: any;
  let mockUserModel: any;
  let mockTeamModel: any;

  beforeEach(async () => {
    mockCompanyModel = {
      findByPk: jest.fn(),
      findOne: jest.fn(),
    };

    mockUserModel = {
      findByPk: jest.fn(),
      findAll: jest.fn(),
    };

    mockTeamModel = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyValidationService,
        {
          provide: getModelToken(Company),
          useValue: mockCompanyModel,
        },
        {
          provide: getModelToken(User),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Team),
          useValue: mockTeamModel,
        },
      ],
    }).compile();

    service = module.get<CompanyValidationService>(CompanyValidationService);
  });

  describe('validateUserBelongsToCompany', () => {
    it('should pass when user belongs to the company', async () => {
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-1',
        company_id: 'company-1',
      });

      await expect(
        service.validateUserBelongsToCompany('user-1', 'company-1')
      ).resolves.not.toThrow();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUserModel.findByPk.mockResolvedValue(null);

      await expect(service.validateUserBelongsToCompany('user-1', 'company-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException when user belongs to different company', async () => {
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-1',
        company_id: 'company-2',
      });

      await expect(service.validateUserBelongsToCompany('user-1', 'company-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException when user has no company', async () => {
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-1',
        company_id: null,
      });

      await expect(service.validateUserBelongsToCompany('user-1', 'company-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('validateUsersBelongToCompany', () => {
    it('should pass when all users belong to the company', async () => {
      mockUserModel.findAll.mockResolvedValue([
        { id: 'user-1', company_id: 'company-1' },
        { id: 'user-2', company_id: 'company-1' },
      ]);

      await expect(
        service.validateUsersBelongToCompany(['user-1', 'user-2'], 'company-1')
      ).resolves.not.toThrow();
    });

    it('should throw NotFoundException when some users do not exist', async () => {
      mockUserModel.findAll.mockResolvedValue([{ id: 'user-1', company_id: 'company-1' }]);

      await expect(
        service.validateUsersBelongToCompany(['user-1', 'user-2'], 'company-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when some users belong to different companies', async () => {
      mockUserModel.findAll.mockResolvedValue([
        { id: 'user-1', company_id: 'company-1' },
        { id: 'user-2', company_id: 'company-2' },
      ]);

      await expect(
        service.validateUsersBelongToCompany(['user-1', 'user-2'], 'company-1')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateCompanyExists', () => {
    it('should return company when it exists', async () => {
      const mockCompany = { id: 'company-1', name: 'Test Company' };
      mockCompanyModel.findByPk.mockResolvedValue(mockCompany);

      const result = await service.validateCompanyExists('company-1');
      expect(result).toBe(mockCompany);
    });

    it('should throw NotFoundException when company does not exist', async () => {
      mockCompanyModel.findByPk.mockResolvedValue(null);

      await expect(service.validateCompanyExists('company-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateUserCanManageCompany', () => {
    it('should pass when user is company owner', async () => {
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-1',
        role: { name: 'Vendor Admin' },
        company_id: 'company-1',
      });

      mockCompanyModel.findByPk.mockResolvedValue({
        id: 'company-1',
        owner_id: 'user-1',
      });

      await expect(
        service.validateUserCanManageCompany('user-1', 'company-1')
      ).resolves.not.toThrow();
    });

    it('should pass when user is company admin', async () => {
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-1',
        role: { name: 'Vendor Admin' },
        company_id: 'company-1',
      });

      mockCompanyModel.findByPk.mockResolvedValue({
        id: 'company-1',
        owner_id: 'user-2',
      });

      await expect(
        service.validateUserCanManageCompany('user-1', 'company-1')
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException when user cannot manage company', async () => {
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-1',
        role: { name: 'Vendor Employee' },
        company_id: 'company-1',
      });

      mockCompanyModel.findByPk.mockResolvedValue({
        id: 'company-1',
        owner_id: 'user-2',
      });

      await expect(service.validateUserCanManageCompany('user-1', 'company-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('validateTeamNameUniqueness', () => {
    it('should pass when team name is unique', async () => {
      mockTeamModel.findOne.mockResolvedValue(null);

      await expect(
        service.validateTeamNameUniqueness('company-1', 'New Team')
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException when team name already exists', async () => {
      mockTeamModel.findOne.mockResolvedValue({
        id: 'team-1',
        name: 'Existing Team',
        company_id: 'company-1',
      });

      await expect(
        service.validateTeamNameUniqueness('company-1', 'Existing Team')
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass when team name exists but is the same team being updated', async () => {
      mockTeamModel.findOne.mockResolvedValue(null);

      await expect(
        service.validateTeamNameUniqueness('company-1', 'Existing Team', 'team-1')
      ).resolves.not.toThrow();
    });
  });

  describe('validateCrossCompanyAccess', () => {
    it('should pass when Acme employee accesses any company', async () => {
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-1',
        role: { name: 'Acme Admin' },
        company_id: 'company-1',
      });

      await expect(
        service.validateCrossCompanyAccess('user-1', 'company-2')
      ).resolves.not.toThrow();
    });

    it('should pass when vendor user accesses their own company', async () => {
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-1',
        role: { name: 'Vendor Admin' },
        company_id: 'company-1',
      });

      await expect(
        service.validateCrossCompanyAccess('user-1', 'company-1')
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException when vendor user accesses different company', async () => {
      mockUserModel.findByPk.mockResolvedValue({
        id: 'user-1',
        role: { name: 'Vendor Admin' },
        company_id: 'company-1',
      });

      await expect(service.validateCrossCompanyAccess('user-1', 'company-2')).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
