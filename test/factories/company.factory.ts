import { Company } from '../../src/modules/company/entities/company.entity';

let companyCounter = 1;

export interface CreateCompanyOptions {
  name?: string;
  subscription_type?: string;
  subscription_status?: string;
  subdomain?: string; // Added for multi-tenant test compatibility
}

export const createTestCompany = async (options: CreateCompanyOptions = {}): Promise<Company> => {
  const defaults = {
    name: `Test Company ${companyCounter++}`,
    subscription_type: 'basic',
    subscription_status: 'active',
    // Don't set owner_id initially to avoid circular dependency
    owner_id: null,
  };

  const companyData = { ...defaults, ...options };

  try {
    return await Company.create(companyData);
  } catch (error) {
    console.error('Error creating test company:', error);
    throw error;
  }
};

export const createTestCompanies = async (
  count: number,
  options: CreateCompanyOptions = {}
): Promise<Company[]> => {
  const companies: Company[] = [];

  for (let i = 0; i < count; i++) {
    const company = await createTestCompany({
      ...options,
      name: `${options.name || 'Test Company'} ${companyCounter++}`,
    });
    companies.push(company);
  }

  return companies;
};
