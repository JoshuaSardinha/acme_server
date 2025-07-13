import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ACME_COMPANY, ACME_ERRORS } from '../constants/acme.constants';
import { CompanyType, CompanyStatus } from '../entities/company.entity';

/**
 * Service to handle Acme company protection and validation.
 * Ensures business rules around the Acme company are enforced.
 */
@Injectable()
export class AcmeProtectionService {
  /**
   * Check if a company ID is the Acme company
   */
  isAcmeCompany(companyId: string): boolean {
    return companyId === ACME_COMPANY.ID;
  }

  /**
   * Validate that the Acme company cannot be deleted
   */
  validateCompanyDeletion(companyId: string): void {
    if (this.isAcmeCompany(companyId)) {
      throw new ForbiddenException(ACME_ERRORS.CANNOT_DELETE);
    }
  }

  /**
   * Validate company type changes
   */
  validateCompanyTypeChange(
    companyId: string,
    newType: CompanyType,
    currentType?: CompanyType
  ): void {
    // Acme company cannot change its type
    if (this.isAcmeCompany(companyId) && newType !== CompanyType.ACME) {
      throw new ForbiddenException(ACME_ERRORS.CANNOT_CHANGE_TYPE);
    }

    // Only Acme company can have ACME type
    if (newType === CompanyType.ACME && !this.isAcmeCompany(companyId)) {
      throw new BadRequestException(ACME_ERRORS.ONLY_ACME_TYPE);
    }
  }

  /**
   * Validate company status changes
   */
  validateCompanyStatusChange(companyId: string, newStatus: CompanyStatus): void {
    // Acme company cannot be suspended or deactivated
    if (this.isAcmeCompany(companyId) && newStatus !== CompanyStatus.ACTIVE) {
      throw new ForbiddenException(ACME_ERRORS.CANNOT_SUSPEND);
    }
  }

  /**
   * Validate company creation data
   */
  validateCompanyCreation(data: { type?: CompanyType; id?: string }): void {
    // Prevent creation of another company with ACME type
    if (data.type === CompanyType.ACME && data.id !== ACME_COMPANY.ID) {
      throw new BadRequestException(ACME_ERRORS.DUPLICATE_ACME);
    }

    // Prevent creation with Acme's fixed ID
    if (data.id === ACME_COMPANY.ID) {
      throw new BadRequestException("Cannot create company with Acme's reserved ID");
    }
  }

  /**
   * Get the Acme company ID
   */
  getAcmeCompanyId(): string {
    return ACME_COMPANY.ID;
  }

  /**
   * Get the Acme company constants
   */
  getAcmeConstants() {
    return ACME_COMPANY;
  }
}
