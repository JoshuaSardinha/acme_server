import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/sequelize';
import { CompanyService } from './company.service';
import { Company } from './entities/company.entity';
import { User } from '../auth/entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { Team } from '../team/entities/team.entity';
import { CompanyValidationService } from './services/company-validation.service';
import { AcmeProtectionService } from './services/acme-protection.service';

describe('CompanyService', () => {
  let service: CompanyService;
  let mockCompanyModel: any;
  let mockUserModel: any;
  let mockRoleModel: any;
  let mockTeamModel: any;

  const mockCompany = {
    id: '123',
    name: 'Test Company',
    address: 'Test Address',
    email: 'test@company.com',
    phone_number: '1234567890',
    owner_id: 'user-123',
  };

  const mockUser = {
    id: 'user-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    role_id: 'role-123',
    is_lawyer: false,
    company_id: null, // User doesn't belong to a company initially
    hasRoleEnum: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    mockCompanyModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    };

    mockUserModel = {
      findByPk: jest.fn(),
      update: jest.fn(),
      findAndCountAll: jest.fn(),
      findAll: jest.fn(),
      sequelize: {
        where: jest.fn(),
        fn: jest.fn(),
        col: jest.fn(),
      },
    };

    mockRoleModel = {
      findOne: jest.fn().mockResolvedValue({
        id: 'role-va',
        name: 'Vendor Admin',
        code: 'vendor_admin',
      }),
    };

    mockTeamModel = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        {
          provide: getModelToken(Company),
          useValue: mockCompanyModel,
        },
        {
          provide: getModelToken(User),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Role),
          useValue: mockRoleModel,
        },
        {
          provide: getModelToken(Team),
          useValue: mockTeamModel,
        },
        {
          provide: CompanyValidationService,
          useValue: {
            validateCompanyExists: jest.fn(),
            validateUserBelongsToCompany: jest.fn(),
            validateCompanyAccess: jest.fn(),
            validateUserCanManageCompany: jest.fn(),
          },
        },
        {
          provide: AcmeProtectionService,
          useValue: {
            validateCompanyCreation: jest.fn(),
            validateCompanyStatusChange: jest.fn(),
            validateCompanyDeletion: jest.fn(),
          },
        },
        {
          provide: getConnectionToken(),
          useValue: {
            transaction: jest.fn().mockImplementation((callback) => {
              const mockTransaction = {
                commit: jest.fn(),
                rollback: jest.fn(),
              };
              return callback ? callback(mockTransaction) : Promise.resolve(mockTransaction);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findCompanyByUserId', () => {
    it('should return a company when found', async () => {
      mockCompanyModel.findOne.mockResolvedValue(mockCompany);

      const result = await service.findCompanyByUserId('user-123');

      expect(result).toEqual(mockCompany);
      expect(mockCompanyModel.findOne).toHaveBeenCalledWith({
        where: { owner_id: 'user-123' },
        attributes: ['id', 'name', 'address', 'email', 'type', 'status'],
      });
    });

    it('should return null when no company is found', async () => {
      mockCompanyModel.findOne.mockResolvedValue(null);

      const result = await service.findCompanyByUserId('user-456');

      expect(result).toBeNull();
      expect(mockCompanyModel.findOne).toHaveBeenCalledWith({
        where: { owner_id: 'user-456' },
        attributes: ['id', 'name', 'address', 'email', 'type', 'status'],
      });
    });
  });

  describe('createCompany', () => {
    const createCompanyDto = {
      name: 'Test Company',
      address: 'Test Address',
      email: 'test@company.com',
      phoneNumber: '1234567890',
      subscriptionType: 'basic',
      subscriptionStatus: 'active',
    };

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    it('should throw BadRequestException if user already owns a company', async () => {
      // Mock user exists and is vendor_admin
      mockUserModel.findByPk.mockResolvedValue(mockUser);
      // Mock that user already owns a company
      mockCompanyModel.findOne.mockResolvedValue(mockCompany);

      await expect(service.createCompany(createCompanyDto, 'user-123')).rejects.toThrow(
        'User already owns a company, a new company cannot be added.'
      );
    });

    it('should create a company successfully if user does not own one', async () => {
      // Mock user exists, is vendor_admin, and doesn't belong to company
      mockUserModel.findByPk.mockResolvedValue(mockUser);
      // Mock that user doesn't own a company
      mockCompanyModel.findOne.mockResolvedValue(null);
      mockCompanyModel.create.mockResolvedValue(mockCompany);
      mockUserModel.update.mockResolvedValue([1]);

      const result = await service.createCompany(createCompanyDto, 'user-123');

      expect(result).toEqual(mockCompany);
      expect(mockCompanyModel.create).toHaveBeenCalledWith(
        {
          name: createCompanyDto.name,
          address: createCompanyDto.address,
          email: createCompanyDto.email,
          phone_number: createCompanyDto.phoneNumber,
          type: 'VENDOR',
          status: 'PENDING_APPROVAL',
          subscription_type: createCompanyDto.subscriptionType,
          subscription_status: createCompanyDto.subscriptionStatus,
          owner_id: 'user-123',
          primary_contact_user_id: 'user-123',
        },
        { transaction: expect.any(Object) }
      );
      expect(mockUserModel.update).toHaveBeenCalledWith(
        { company_id: mockCompany.id, role_id: expect.any(String) },
        { where: { id: 'user-123' }, transaction: expect.any(Object) }
      );
    });
  });
});
