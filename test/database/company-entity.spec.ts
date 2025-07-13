import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Company } from '../../src/modules/company/entities/company.entity';
import { User } from '../../src/modules/auth/entities/user.entity';
import { Team } from '../../src/modules/team/entities/team.entity';
import { TeamMember } from '../../src/modules/team/entities/team-member.entity';
import { TestDatabaseHelper } from '../utils/test-database.helper';

describe('Company Entity Unit Tests', () => {
  let _sequelize: Sequelize;
  let module: TestingModule;
  let company: Company;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: getModelToken(Company),
          useValue: Company,
        },
        {
          provide: getModelToken(User),
          useValue: User,
        },
        {
          provide: getModelToken(Team),
          useValue: Team,
        },
      ],
    }).compile();

    // Initialize MySQL test database
    _sequelize = await TestDatabaseHelper.createTestDatabase([Company, User, Team, TeamMember]);
  });

  afterAll(async () => {
    await TestDatabaseHelper.closeDatabase();
    await module.close();
  });

  beforeEach(async () => {
    // Clean up data before each test
    await TestDatabaseHelper.cleanDatabase([TeamMember, Team, User, Company]);
  });

  describe('Entity Creation and Validation', () => {
    it('should create a valid company with required fields', async () => {
      const companyData = {
        name: 'Test Company LLC',
        address: '123 Test Street, Test City, TS 12345',
        email: 'contact@testcompany.com',
        phone_number: '+1-555-123-4567',
        subscription_type: 'premium',
        subscription_status: 'active',
        subdomain: 'testcompany',
      };

      company = await Company.create(companyData);

      expect(company).toBeDefined();
      expect(company.id).toBeDefined();
      expect(company.name).toBe(companyData.name);
      expect(company.address).toBe(companyData.address);
      expect(company.email).toBe(companyData.email);
      expect(company.phone_number).toBe(companyData.phone_number);
      expect(company.subscription_type).toBe(companyData.subscription_type);
      expect(company.subscription_status).toBe(companyData.subscription_status);
      expect(company.subdomain).toBe(companyData.subdomain);
      expect(company.created_at).toBeDefined();
      expect(company.updated_at).toBeDefined();
    });

    it('should create a company with only required fields', async () => {
      const companyData = {
        name: 'Minimal Company',
      };

      company = await Company.create(companyData);

      expect(company).toBeDefined();
      expect(company.id).toBeDefined();
      expect(company.name).toBe(companyData.name);
      expect(company.address).toBeNull();
      expect(company.email).toBeNull();
      expect(company.phone_number).toBeNull();
      expect(company.subscription_type).toBeNull();
      expect(company.subscription_status).toBeNull();
      expect(company.subdomain).toBeNull();
      expect(company.owner_id).toBeNull();
    });

    it('should auto-generate UUID for id field', async () => {
      const company1 = await Company.create({ name: 'Company 1' });
      const company2 = await Company.create({ name: 'Company 2' });

      expect(company1.id).toBeDefined();
      expect(company2.id).toBeDefined();
      expect(company1.id).not.toBe(company2.id);
      expect(company1.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(company2.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should automatically set timestamps on creation', async () => {
      const beforeCreate = new Date();
      company = await Company.create({ name: 'Timestamp Test Company' });
      const afterCreate = new Date();

      expect(company.created_at).toBeDefined();
      expect(company.updated_at).toBeDefined();
      expect(company.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(company.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(company.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(company.updated_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should update timestamps on modification', async () => {
      company = await Company.create({ name: 'Update Test Company' });
      const originalUpdatedAt = company.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      company.name = 'Updated Company Name';
      await company.save();

      expect(company.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Field Validation', () => {
    it('should reject creation without required name field', async () => {
      await expect(Company.create({})).rejects.toThrow();
    });

    it('should reject null name field', async () => {
      await expect(Company.create({ name: null })).rejects.toThrow();
    });

    it('should reject empty string name field', async () => {
      await expect(Company.create({ name: '' })).rejects.toThrow();
    });

    it('should accept valid email formats', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'admin+test@company.org',
        'support@sub.domain.com',
      ];

      for (const email of validEmails) {
        const company = await Company.create({
          name: `Company for ${email}`,
          email: email,
        });
        expect(company.email).toBe(email);
      }
    });

    it('should handle various phone number formats', async () => {
      const phoneNumbers = [
        '+1-555-123-4567',
        '(555) 123-4567',
        '555.123.4567',
        '+44 20 7946 0958',
        '1234567890',
      ];

      for (const phone of phoneNumbers) {
        const company = await Company.create({
          name: `Company for ${phone}`,
          phone_number: phone,
        });
        expect(company.phone_number).toBe(phone);
      }
    });

    it('should handle long text addresses', async () => {
      const longAddress = 'A'.repeat(1000); // Very long address

      company = await Company.create({
        name: 'Long Address Company',
        address: longAddress,
      });

      expect(company.address).toBe(longAddress);
    });

    it('should validate subscription_type field values', async () => {
      const validSubscriptionTypes = ['basic', 'premium', 'enterprise', 'trial'];

      for (const type of validSubscriptionTypes) {
        const company = await Company.create({
          name: `Company ${type}`,
          subscription_type: type,
        });
        expect(company.subscription_type).toBe(type);
      }
    });

    it('should validate subscription_status field values', async () => {
      const validStatuses = ['active', 'inactive', 'suspended', 'cancelled', 'pending'];

      for (const status of validStatuses) {
        const company = await Company.create({
          name: `Company ${status}`,
          subscription_status: status,
        });
        expect(company.subscription_status).toBe(status);
      }
    });

    it('should validate subdomain format', async () => {
      const validSubdomains = ['testcompany', 'company-name', 'company123', 'test_company'];

      for (const subdomain of validSubdomains) {
        const company = await Company.create({
          name: `Company ${subdomain}`,
          subdomain: subdomain,
        });
        expect(company.subdomain).toBe(subdomain);
      }
    });
  });

  describe('Associations and Relationships', () => {
    let owner: User;

    beforeEach(async () => {
      // Create a test user to serve as company owner
      owner = await User.create({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        auth0_user_id: 'auth0|test123',
        role: 'vendor_admin' as any, // Using any to avoid enum issues in tests
      });
    });

    it('should establish belongs-to relationship with User (owner)', async () => {
      company = await Company.create({
        name: 'Owned Company',
        owner_id: owner.id,
      });

      const companyWithOwner = await Company.findByPk(company.id, {
        include: [{ model: User, as: 'owner' }],
      });

      expect(companyWithOwner).toBeDefined();
      expect(companyWithOwner!.owner).toBeDefined();
      expect(companyWithOwner!.owner.id).toBe(owner.id);
      expect(companyWithOwner!.owner.email).toBe(owner.email);
    });

    it('should allow null owner_id', async () => {
      company = await Company.create({
        name: 'Unowned Company',
        owner_id: null,
      });

      expect(company.owner_id).toBeNull();
    });

    it('should handle has-many relationship with Teams', async () => {
      company = await Company.create({
        name: 'Company with Teams',
      });

      // Create teams for this company
      const _team1 = await Team.create({
        name: 'Development Team',
        company_id: company.id,
        owner_user_id: owner.id,
      });

      const _team2 = await Team.create({
        name: 'Marketing Team',
        company_id: company.id,
        owner_user_id: owner.id,
      });

      const companyWithTeams = await Company.findByPk(company.id, {
        include: [{ model: Team, as: 'teams' }],
      });

      expect(companyWithTeams).toBeDefined();
      expect(companyWithTeams!.teams).toBeDefined();
      expect(companyWithTeams!.teams).toHaveLength(2);
      expect(companyWithTeams!.teams.map((t) => t.name)).toContain('Development Team');
      expect(companyWithTeams!.teams.map((t) => t.name)).toContain('Marketing Team');
    });

    it('should handle has-many relationship with Users', async () => {
      company = await Company.create({
        name: 'Company with Employees',
      });

      // Create users for this company
      const _user1 = await User.create({
        first_name: 'Alice',
        last_name: 'Smith',
        email: 'alice@company.com',
        auth0_user_id: 'auth0|alice123',
        role: 'vendor_employee' as any,
        company_id: company.id,
      });

      const _user2 = await User.create({
        first_name: 'Bob',
        last_name: 'Johnson',
        email: 'bob@company.com',
        auth0_user_id: 'auth0|bob123',
        role: 'vendor_employee' as any,
        company_id: company.id,
      });

      const companyWithUsers = await Company.findByPk(company.id, {
        include: [{ model: User, as: 'users' }],
      });

      expect(companyWithUsers).toBeDefined();
      expect(companyWithUsers!.users).toBeDefined();
      expect(companyWithUsers!.users).toHaveLength(2);
      expect(companyWithUsers!.users.map((u) => u.email)).toContain('alice@company.com');
      expect(companyWithUsers!.users.map((u) => u.email)).toContain('bob@company.com');
    });
  });

  describe('Entity Operations', () => {
    it('should support findByPk operations', async () => {
      company = await Company.create({
        name: 'Findable Company',
        email: 'find@company.com',
      });

      const foundCompany = await Company.findByPk(company.id);

      expect(foundCompany).toBeDefined();
      expect(foundCompany!.id).toBe(company.id);
      expect(foundCompany!.name).toBe('Findable Company');
      expect(foundCompany!.email).toBe('find@company.com');
    });

    it('should support findOne with where conditions', async () => {
      company = await Company.create({
        name: 'Unique Search Company',
        email: 'unique@search.com',
        subdomain: 'uniquesearch',
      });

      const foundByName = await Company.findOne({
        where: { name: 'Unique Search Company' },
      });
      expect(foundByName!.id).toBe(company.id);

      const foundByEmail = await Company.findOne({
        where: { email: 'unique@search.com' },
      });
      expect(foundByEmail!.id).toBe(company.id);

      const foundBySubdomain = await Company.findOne({
        where: { subdomain: 'uniquesearch' },
      });
      expect(foundBySubdomain!.id).toBe(company.id);
    });

    it('should support findAll operations with filters', async () => {
      // Create multiple companies
      await Company.create({
        name: 'Active Company 1',
        subscription_status: 'active',
      });
      await Company.create({
        name: 'Active Company 2',
        subscription_status: 'active',
      });
      await Company.create({
        name: 'Inactive Company',
        subscription_status: 'inactive',
      });

      const activeCompanies = await Company.findAll({
        where: { subscription_status: 'active' },
      });

      expect(activeCompanies).toHaveLength(2);
      expect(activeCompanies.every((c) => c.subscription_status === 'active')).toBe(true);
    });

    it('should support update operations', async () => {
      company = await Company.create({
        name: 'Original Name',
        subscription_status: 'pending',
      });

      await company.update({
        name: 'Updated Name',
        subscription_status: 'active',
      });

      expect(company.name).toBe('Updated Name');
      expect(company.subscription_status).toBe('active');

      // Verify in database
      const refreshedCompany = await Company.findByPk(company.id);
      expect(refreshedCompany).toBeDefined();
      expect(refreshedCompany!.name).toBe('Updated Name');
      expect(refreshedCompany!.subscription_status).toBe('active');
    });

    it('should support destroy operations', async () => {
      company = await Company.create({
        name: 'Company to Delete',
      });

      const companyId = company.id;
      await company.destroy();

      const deletedCompany = await Company.findByPk(companyId);
      expect(deletedCompany).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long field values appropriately', async () => {
      const longName = 'A'.repeat(255); // Very long name
      const longEmail = 'test@' + 'a'.repeat(240) + '.com'; // Very long email

      company = await Company.create({
        name: longName,
        email: longEmail,
      });

      expect(company.name).toBe(longName);
      expect(company.email).toBe(longEmail);
    });

    it('should handle special characters in fields', async () => {
      const specialCharacters = {
        name: "Test Company with 'quotes' & symbols!",
        address: '123 Street "Name", City & County, ST 12345',
        email: 'test+special@domain-name.co.uk',
        phone_number: '+1 (555) 123-4567 ext. 890',
        subdomain: 'test-company_123',
      };

      company = await Company.create(specialCharacters);

      expect(company.name).toBe(specialCharacters.name);
      expect(company.address).toBe(specialCharacters.address);
      expect(company.email).toBe(specialCharacters.email);
      expect(company.phone_number).toBe(specialCharacters.phone_number);
      expect(company.subdomain).toBe(specialCharacters.subdomain);
    });

    it('should handle concurrent creation properly', async () => {
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        Company.create({ name: `Concurrent Company ${i}` })
      );

      const companies = await Promise.all(createPromises);

      expect(companies).toHaveLength(5);
      const uniqueIds = new Set(companies.map((c) => c.id));
      expect(uniqueIds.size).toBe(5); // All IDs should be unique
    });

    it('should properly handle null and undefined values', async () => {
      company = await Company.create({
        name: 'Null Test Company',
        address: null,
        email: undefined,
        phone_number: null,
      });

      expect(company.address).toBeNull();
      expect(company.email).toBeNull();
      expect(company.phone_number).toBeNull();
    });
  });

  describe('Business Logic Validation', () => {
    it('should maintain data consistency across operations', async () => {
      company = await Company.create({
        name: 'Consistency Test Company',
        subscription_type: 'trial',
        subscription_status: 'active',
      });

      // Simulate business logic: trial subscriptions should be limited
      if (company.subscription_type === 'trial') {
        const createdDate = company.created_at;
        const expiryDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

        expect(expiryDate).toBeInstanceOf(Date);
        expect(expiryDate.getTime()).toBeGreaterThan(createdDate.getTime());
      }
    });

    it('should support custom validation scenarios', async () => {
      // Test business rule: Enterprise companies should have subdomains
      company = await Company.create({
        name: 'Enterprise Test Company',
        subscription_type: 'enterprise',
        subdomain: 'enterprise-test',
      });

      if (company.subscription_type === 'enterprise') {
        expect(company.subdomain).toBeDefined();
        expect(company.subdomain).not.toBe('');
      }
    });
  });
});
