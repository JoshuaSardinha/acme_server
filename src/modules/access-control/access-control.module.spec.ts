import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { BusinessValidationGuard } from './guards/business-validation.guard';
import { CompanyValidationService } from '../company/services/company-validation.service';
import { TeamValidationService } from '../team/services/team-validation.service';
import { MembershipValidationService } from '../team/services/membership-validation.service';

describe('AccessControlModule - Unit Test', () => {
  let guard: BusinessValidationGuard;
  let reflector: Reflector;
  let companyValidationService: jest.Mocked<CompanyValidationService>;
  let teamValidationService: jest.Mocked<TeamValidationService>;
  let membershipValidationService: jest.Mocked<MembershipValidationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessValidationGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: CompanyValidationService,
          useValue: {
            validateCrossCompanyAccess: jest.fn(),
            validateUserBelongsToCompany: jest.fn(),
          },
        },
        {
          provide: TeamValidationService,
          useValue: {
            validateTeamExistsInCompany: jest.fn(),
          },
        },
        {
          provide: MembershipValidationService,
          useValue: {
            validateMembershipOperationPermissions: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<BusinessValidationGuard>(BusinessValidationGuard);
    reflector = module.get<Reflector>(Reflector);
    companyValidationService = module.get(CompanyValidationService);
    teamValidationService = module.get(TeamValidationService);
    membershipValidationService = module.get(MembershipValidationService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when no validation config is set', async () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user-123' },
          params: {},
          body: {},
        }),
      }),
      getHandler: () => jest.fn(),
    } as any;

    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const result = await guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should validate company access when configured', async () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user-123' },
          params: { companyId: 'company-456' },
          body: {},
        }),
      }),
      getHandler: () => jest.fn(),
    } as any;

    jest.spyOn(reflector, 'get').mockReturnValue({
      validateCompanyAccess: true,
    });

    companyValidationService.validateCrossCompanyAccess.mockResolvedValue(undefined);

    const result = await guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
    expect(companyValidationService.validateCrossCompanyAccess).toHaveBeenCalledWith(
      'user-123',
      'company-456'
    );
  });
});
