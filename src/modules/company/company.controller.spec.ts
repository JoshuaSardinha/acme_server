import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('CompanyController', () => {
  let controller: CompanyController;
  let service: CompanyService;

  const mockCompanyService = {
    getCompanyById: jest.fn(),
    registerVendor: jest.fn(),
    listCompanies: jest.fn(),
    approveVendor: jest.fn(),
    rejectVendor: jest.fn(),
    suspendVendor: jest.fn(),
    reactivateVendor: jest.fn(),
    createCompany: jest.fn(),
    addUserToCompany: jest.fn(),
    removeUserFromCompany: jest.fn(),
    getCompanyUsers: jest.fn(),
    searchCompanyUsers: jest.fn(),
    getCompanyAuditLog: jest.fn(),
  };

  const mockCompanyData = {
    id: 'company-123',
    name: 'Test Company',
    address: '123 Test St',
    email: 'test@company.com',
    phoneNumber: '+1234567890',
    type: 'VENDOR',
    status: 'ACTIVE',
    subdomain: 'testcompany',
    subscription_type: 'PREMIUM',
    subscription_status: 'ACTIVE',
    created_at: new Date(),
    updated_at: new Date(),
    owner: {
      id: 'user-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: 'vendor_admin',
      isLawyer: false,
      companyId: 'company-123',
    },
    primaryContact: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [
        {
          provide: CompanyService,
          useValue: mockCompanyService,
        },
      ],
    })
      .overrideGuard(require('../../core/guards/client-version.guard').ClientVersionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../../core/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../../core/guards/super-admin-bypass.guard').SuperAdminBypassGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../../core/guards/permissions.guard').PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../../core/guards/company-admin.guard').CompanyAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CompanyController>(CompanyController);
    service = module.get<CompanyService>(CompanyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUserCompany', () => {
    it('should return company information for non-client users', async () => {
      const mockRequest = {
        user: {
          id: 'user-123',
          company_id: 'company-123',
          role: {
            code: 'vendor_admin',
            name: 'Vendor Admin',
          },
        },
      };

      mockCompanyService.getCompanyById.mockResolvedValue(mockCompanyData);

      const result = await controller.getCurrentUserCompany(mockRequest);

      expect(service.getCompanyById).toHaveBeenCalledWith('company-123');
      expect(result).toEqual(mockCompanyData);
    });

    it('should throw ForbiddenException for client users', async () => {
      const mockRequest = {
        user: {
          id: 'user-456',
          company_id: 'company-123',
          role: {
            code: 'client',
            name: 'Client',
          },
        },
      };

      await expect(controller.getCurrentUserCompany(mockRequest)).rejects.toThrow(
        new ForbiddenException(
          'Client users cannot access company information through this endpoint'
        )
      );

      expect(service.getCompanyById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user has no company_id', async () => {
      const mockRequest = {
        user: {
          id: 'user-789',
          company_id: null,
          role: {
            code: 'vendor_employee',
            name: 'Vendor Employee',
          },
        },
      };

      await expect(controller.getCurrentUserCompany(mockRequest)).rejects.toThrow(
        new NotFoundException('User does not belong to any company')
      );

      expect(service.getCompanyById).not.toHaveBeenCalled();
    });

    it('should handle different non-client role types', async () => {
      const roleTypes = [
        { code: 'vendor_employee', name: 'Vendor Employee' },
        { code: 'vendor_admin', name: 'Vendor Admin' },
        { code: 'national_niner_employee', name: 'National Niner Employee' },
        { code: 'national_niner_admin', name: 'National Niner Admin' },
        { code: 'vendor_manager', name: 'Vendor Manager' },
        { code: 'national_niner_manager', name: 'National Niner Manager' },
        { code: 'super_admin', name: 'Super Admin' },
      ];

      for (const role of roleTypes) {
        const mockRequest = {
          user: {
            id: 'user-123',
            company_id: 'company-123',
            role: role,
          },
        };

        mockCompanyService.getCompanyById.mockResolvedValue(mockCompanyData);

        const result = await controller.getCurrentUserCompany(mockRequest);

        expect(service.getCompanyById).toHaveBeenCalledWith('company-123');
        expect(result).toEqual(mockCompanyData);
      }
    });

    it('should handle missing role gracefully', async () => {
      const mockRequest = {
        user: {
          id: 'user-123',
          company_id: 'company-123',
          role: null,
        },
      };

      mockCompanyService.getCompanyById.mockResolvedValue(mockCompanyData);

      const result = await controller.getCurrentUserCompany(mockRequest);

      expect(service.getCompanyById).toHaveBeenCalledWith('company-123');
      expect(result).toEqual(mockCompanyData);
    });
  });
});
