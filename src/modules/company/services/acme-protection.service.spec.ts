import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AcmeProtectionService } from './acme-protection.service';
import { ACME_COMPANY, ACME_ERRORS } from '../constants/acme.constants';
import { CompanyType, CompanyStatus } from '../entities/company.entity';

describe('AcmeProtectionService', () => {
  let service: AcmeProtectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AcmeProtectionService],
    }).compile();

    service = module.get<AcmeProtectionService>(AcmeProtectionService);
  });

  describe('isAcmeCompany', () => {
    it('should return true for Acme company ID', () => {
      expect(service.isAcmeCompany(ACME_COMPANY.ID)).toBe(true);
    });

    it('should return false for other company IDs', () => {
      expect(service.isAcmeCompany('some-other-company-id')).toBe(false);
    });
  });

  describe('validateCompanyDeletion', () => {
    it('should throw ForbiddenException when trying to delete Acme company', () => {
      expect(() => {
        service.validateCompanyDeletion(ACME_COMPANY.ID);
      }).toThrow(new ForbiddenException(ACME_ERRORS.CANNOT_DELETE));
    });

    it('should not throw for other company deletions', () => {
      expect(() => {
        service.validateCompanyDeletion('other-company-id');
      }).not.toThrow();
    });
  });

  describe('validateCompanyTypeChange', () => {
    it('should throw ForbiddenException when trying to change Acme company type', () => {
      expect(() => {
        service.validateCompanyTypeChange(ACME_COMPANY.ID, CompanyType.VENDOR, CompanyType.ACME);
      }).toThrow(new ForbiddenException(ACME_ERRORS.CANNOT_CHANGE_TYPE));
    });

    it('should throw BadRequestException when trying to set ACME type on other company', () => {
      expect(() => {
        service.validateCompanyTypeChange('other-company-id', CompanyType.ACME, CompanyType.VENDOR);
      }).toThrow(new BadRequestException(ACME_ERRORS.ONLY_ACME_TYPE));
    });

    it('should allow Acme company to keep its type', () => {
      expect(() => {
        service.validateCompanyTypeChange(ACME_COMPANY.ID, CompanyType.ACME, CompanyType.ACME);
      }).not.toThrow();
    });

    it('should allow vendor companies to change to vendor type', () => {
      expect(() => {
        service.validateCompanyTypeChange(
          'vendor-company-id',
          CompanyType.VENDOR,
          CompanyType.VENDOR
        );
      }).not.toThrow();
    });
  });

  describe('validateCompanyStatusChange', () => {
    it('should throw ForbiddenException when trying to suspend Acme company', () => {
      expect(() => {
        service.validateCompanyStatusChange(ACME_COMPANY.ID, CompanyStatus.SUSPENDED);
      }).toThrow(new ForbiddenException(ACME_ERRORS.CANNOT_SUSPEND));
    });

    it('should throw ForbiddenException when trying to reject Acme company', () => {
      expect(() => {
        service.validateCompanyStatusChange(ACME_COMPANY.ID, CompanyStatus.REJECTED);
      }).toThrow(new ForbiddenException(ACME_ERRORS.CANNOT_SUSPEND));
    });

    it('should allow Acme company to remain active', () => {
      expect(() => {
        service.validateCompanyStatusChange(ACME_COMPANY.ID, CompanyStatus.ACTIVE);
      }).not.toThrow();
    });

    it('should allow other companies to change status', () => {
      expect(() => {
        service.validateCompanyStatusChange('other-company-id', CompanyStatus.SUSPENDED);
      }).not.toThrow();
    });
  });

  describe('validateCompanyCreation', () => {
    it('should throw BadRequestException when trying to create another ACME type company', () => {
      expect(() => {
        service.validateCompanyCreation({
          type: CompanyType.ACME,
          id: 'some-other-id',
        });
      }).toThrow(new BadRequestException(ACME_ERRORS.DUPLICATE_ACME));
    });

    it('should throw BadRequestException when trying to create company with Acme ID', () => {
      expect(() => {
        service.validateCompanyCreation({
          type: CompanyType.VENDOR,
          id: ACME_COMPANY.ID,
        });
      }).toThrow(new BadRequestException("Cannot create company with Acme's reserved ID"));
    });

    it('should allow creation of vendor companies', () => {
      expect(() => {
        service.validateCompanyCreation({
          type: CompanyType.VENDOR,
          id: 'some-vendor-id',
        });
      }).not.toThrow();
    });

    it('should allow creation without specifying type or id', () => {
      expect(() => {
        service.validateCompanyCreation({});
      }).not.toThrow();
    });
  });

  describe('getAcmeCompanyId', () => {
    it('should return the correct Acme company ID', () => {
      expect(service.getAcmeCompanyId()).toBe(ACME_COMPANY.ID);
    });
  });

  describe('getAcmeConstants', () => {
    it('should return the Acme constants', () => {
      expect(service.getAcmeConstants()).toBe(ACME_COMPANY);
    });
  });
});
