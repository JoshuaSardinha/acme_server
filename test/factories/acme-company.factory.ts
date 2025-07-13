import { Company } from '../../src/modules/company/entities/company.entity';
import { ACME_COMPANY } from '../../src/modules/company/constants/acme.constants';

/**
 * Ensures the Acme company exists in the database for testing.
 * This should be called in test setup to guarantee the company exists.
 *
 * @returns Promise<Company> The Acme company instance
 */
export const ensureAcmeCompanyExists = async (): Promise<Company> => {
  try {
    // Try to find existing Acme company
    let company = await Company.findByPk(ACME_COMPANY.ID);

    if (!company) {
      // Create the Acme company if it doesn't exist
      company = await Company.create({
        id: ACME_COMPANY.ID,
        name: ACME_COMPANY.NAME,
        type: ACME_COMPANY.TYPE,
        status: ACME_COMPANY.STATUS,
        email: ACME_COMPANY.EMAIL,
        address: ACME_COMPANY.ADDRESS,
        phone_number: ACME_COMPANY.PHONE,
        subdomain: ACME_COMPANY.SUBDOMAIN,
      });

      console.log('✓ Acme company created for tests');
    } else {
      // Ensure the existing company has correct properties
      await company.update({
        name: ACME_COMPANY.NAME,
        type: ACME_COMPANY.TYPE,
        status: ACME_COMPANY.STATUS,
        email: ACME_COMPANY.EMAIL,
        address: ACME_COMPANY.ADDRESS,
        phone_number: ACME_COMPANY.PHONE,
        subdomain: ACME_COMPANY.SUBDOMAIN,
      });

      console.log('✓ Acme company verified and updated for tests');
    }

    return company;
  } catch (error) {
    console.error('Error ensuring Acme company exists:', error);
    throw error;
  }
};

/**
 * Gets the Acme company ID.
 * Use this when creating Acme users to ensure they belong to the correct company.
 *
 * @returns string The Acme company ID
 */
export const getAcmeCompanyId = (): string => {
  return ACME_COMPANY.ID;
};
