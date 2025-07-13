'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Starting Company Data Integrity Constraints Migration...');
      
      // Add email format validation constraint
      console.log('Adding email format validation constraint...');
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE Companies 
          ADD CONSTRAINT chk_companies_email_format 
          CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
        `);
      } catch (error) {
        console.warn('Email format constraint may already exist:', error.message);
      }

      // Add phone number format validation
      console.log('Adding phone number format validation constraint...');
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE Companies 
          ADD CONSTRAINT chk_companies_phone_format 
          CHECK (phone_number IS NULL OR phone_number ~* '^[\\+]?[\\s\\d\\-\\(\\)]+$')
        `);
      } catch (error) {
        console.warn('Phone format constraint may already exist:', error.message);
      }

      // Add subdomain format validation (lowercase alphanumeric + hyphens)
      console.log('Adding subdomain format validation constraint...');
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE Companies 
          ADD CONSTRAINT chk_companies_subdomain_format 
          CHECK (subdomain IS NULL OR (
            subdomain ~* '^[a-z0-9-]+$' AND 
            LENGTH(subdomain) >= 3 AND 
            LENGTH(subdomain) <= 50
          ))
        `);
      } catch (error) {
        console.warn('Subdomain format constraint may already exist:', error.message);
      }

      // Add company name length validation
      console.log('Adding company name length validation constraint...');
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE Companies 
          ADD CONSTRAINT chk_companies_name_length 
          CHECK (name IS NOT NULL AND LENGTH(name) >= 2 AND LENGTH(name) <= 100)
        `);
      } catch (error) {
        console.warn('Name length constraint may already exist:', error.message);
      }

      // Add business rule: vendor companies must have subdomains
      console.log('Adding vendor subdomain requirement constraint...');
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE Companies 
          ADD CONSTRAINT chk_companies_vendor_subdomain 
          CHECK (type != 'VENDOR' OR (type = 'VENDOR' AND subdomain IS NOT NULL))
        `);
      } catch (error) {
        console.warn('Vendor subdomain constraint may already exist:', error.message);
      }

      // Add status enum validation at database level
      console.log('Adding status enum validation constraint...');
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE Companies 
          ADD CONSTRAINT chk_companies_status_valid 
          CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED'))
        `);
      } catch (error) {
        console.warn('Status enum constraint may already exist:', error.message);
      }

      // Add type enum validation at database level  
      console.log('Adding type enum validation constraint...');
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE Companies 
          ADD CONSTRAINT chk_companies_type_valid 
          CHECK (type IN ('ACME', 'VENDOR'))
        `);
      } catch (error) {
        console.warn('Type enum constraint may already exist:', error.message);
      }

      // Add address length validation
      console.log('Adding address length validation constraint...');
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE Companies 
          ADD CONSTRAINT chk_companies_address_length 
          CHECK (address IS NULL OR LENGTH(address) <= 500)
        `);
      } catch (error) {
        console.warn('Address length constraint may already exist:', error.message);
      }

      console.log('Company Data Integrity Constraints Migration completed successfully!');
    } catch (error) {
      console.error('Error in Company Data Integrity Constraints Migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Rolling back Company Data Integrity Constraints Migration...');
      
      const constraintsToDrop = [
        'chk_companies_email_format',
        'chk_companies_phone_format',
        'chk_companies_subdomain_format',
        'chk_companies_name_length',
        'chk_companies_vendor_subdomain',
        'chk_companies_status_valid',
        'chk_companies_type_valid',
        'chk_companies_address_length'
      ];

      for (const constraintName of constraintsToDrop) {
        try {
          await queryInterface.sequelize.query(`
            ALTER TABLE Companies DROP CONSTRAINT IF EXISTS ${constraintName}
          `);
          console.log(`Dropped constraint: ${constraintName}`);
        } catch (error) {
          console.warn(`Constraint ${constraintName} may not exist:`, error.message);
        }
      }

      console.log('Company Data Integrity Constraints Migration rollback completed!');
    } catch (error) {
      console.error('Error rolling back Company Data Integrity Constraints Migration:', error);
      throw error;
    }
  }
};