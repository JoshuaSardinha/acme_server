'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      console.log('Adding data integrity constraints for Company management...');
      
      // Helper function to check if constraint exists
      const constraintExists = async (constraintName) => {
        try {
          const [results] = await queryInterface.sequelize.query(
            `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS 
             WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?`,
            { replacements: [constraintName], transaction }
          );
          return results.length > 0;
        } catch (error) {
          return false;
        }
      };

      // 1. Add CHECK constraint for valid email format
      console.log('Adding email format validation constraint...');
      if (!(await constraintExists('chk_companies_valid_email'))) {
        await queryInterface.addConstraint('Companies', {
          fields: ['email'],
          type: 'check',
          name: 'chk_companies_valid_email',
          where: {
            [Sequelize.Op.or]: [
              { email: null },
              { 
                email: {
                  [Sequelize.Op.regexp]: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
                }
              }
            ]
          }
        }, { transaction });
      } else {
        console.log('Email constraint already exists, skipping...');
      }
      
      // 2. Add CHECK constraint for valid phone number format (if provided)
      console.log('Adding phone number format validation constraint...');
      if (!(await constraintExists('chk_companies_valid_phone'))) {
        await queryInterface.addConstraint('Companies', {
          fields: ['phone_number'],
          type: 'check',
          name: 'chk_companies_valid_phone',
          where: {
            [Sequelize.Op.or]: [
              { phone_number: null },
              { phone_number: '' },
              { 
                phone_number: {
                  [Sequelize.Op.regexp]: '^[\\+]?[\\s\\d\\-\\(\\)]+$'
                }
              }
            ]
          }
        }, { transaction });
      } else {
        console.log('Phone constraint already exists, skipping...');
      }
      
      // 3. Add CHECK constraint for valid subdomain format
      console.log('Adding subdomain format validation constraint...');
      if (!(await constraintExists('chk_companies_valid_subdomain'))) {
        await queryInterface.addConstraint('Companies', {
          fields: ['subdomain'],
          type: 'check',
          name: 'chk_companies_valid_subdomain',
          where: {
            [Sequelize.Op.or]: [
              { subdomain: null },
              { 
                subdomain: {
                  [Sequelize.Op.regexp]: '^[a-z0-9-]+$'
                }
              }
            ]
          }
        }, { transaction });
      } else {
        console.log('Subdomain constraint already exists, skipping...');
      }
      
      // 4. Add CHECK constraint for subdomain length
      console.log('Adding subdomain length constraint...');
      if (!(await constraintExists('chk_companies_subdomain_length'))) {
        await queryInterface.addConstraint('Companies', {
          fields: ['subdomain'],
          type: 'check',
          name: 'chk_companies_subdomain_length',
          where: {
            [Sequelize.Op.or]: [
              { subdomain: null },
              Sequelize.where(
                Sequelize.fn('LENGTH', Sequelize.col('subdomain')),
                { [Sequelize.Op.between]: [3, 50] }
              )
            ]
          }
        }, { transaction });
      } else {
        console.log('Subdomain length constraint already exists, skipping...');
      }
      
      // 5. Add CHECK constraint for company name length
      console.log('Adding company name length constraint...');
      if (!(await constraintExists('chk_companies_name_length'))) {
        await queryInterface.addConstraint('Companies', {
          fields: ['name'],
          type: 'check',
          name: 'chk_companies_name_length',
          where: Sequelize.where(
            Sequelize.fn('LENGTH', Sequelize.fn('TRIM', Sequelize.col('name'))),
            { [Sequelize.Op.between]: [2, 100] }
          )
        }, { transaction });
      } else {
        console.log('Name length constraint already exists, skipping...');
      }
      
      // 6. Add CHECK constraint for valid status transitions
      console.log('Adding status validation constraint...');
      if (!(await constraintExists('chk_companies_valid_status'))) {
        await queryInterface.addConstraint('Companies', {
          fields: ['status'],
          type: 'check',
          name: 'chk_companies_valid_status',
          where: {
            status: {
              [Sequelize.Op.in]: ['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED']
            }
          }
        }, { transaction });
      } else {
        console.log('Status constraint already exists, skipping...');
      }
      
      // 7. Add CHECK constraint for valid company types
      console.log('Adding company type validation constraint...');
      if (!(await constraintExists('chk_companies_valid_type'))) {
        await queryInterface.addConstraint('Companies', {
          fields: ['type'],
          type: 'check',
          name: 'chk_companies_valid_type',
          where: {
            type: {
              [Sequelize.Op.in]: ['ACME', 'VENDOR']
            }
          }
        }, { transaction });
      } else {
        console.log('Type constraint already exists, skipping...');
      }
      
      // 8. Add CHECK constraint to ensure VENDOR companies have subdomains
      console.log('Adding vendor subdomain requirement constraint...');
      if (!(await constraintExists('chk_companies_vendor_subdomain'))) {
        await queryInterface.addConstraint('Companies', {
          fields: ['type', 'subdomain'],
          type: 'check',
          name: 'chk_companies_vendor_subdomain',
          where: {
            [Sequelize.Op.or]: [
              { type: 'ACME' },
              { 
                [Sequelize.Op.and]: [
                  { type: 'VENDOR' },
                  { subdomain: { [Sequelize.Op.ne]: null } },
                  { subdomain: { [Sequelize.Op.ne]: '' } }
                ]
              }
            ]
          }
        }, { transaction });
      } else {
        console.log('Vendor subdomain constraint already exists, skipping...');
      }
      
      // 9. Skip contact relationship constraint due to foreign key conflicts
      console.log('Skipping owner/primary contact relationship constraint (conflicts with foreign keys)...');
      
      console.log('Data integrity constraints added successfully');
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      console.log('Removing data integrity constraints...');
      
      const constraintsToRemove = [
        'chk_companies_contact_relationship',
        'chk_companies_vendor_subdomain',
        'chk_companies_valid_type',
        'chk_companies_valid_status',
        'chk_companies_name_length',
        'chk_companies_subdomain_length',
        'chk_companies_valid_subdomain',
        'chk_companies_valid_phone',
        'chk_companies_valid_email'
      ];
      
      // First check which constraints actually exist
      const [existingConstraints] = await queryInterface.sequelize.query(`
        SELECT cc.CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
        JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc 
          ON cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME 
          AND cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
        WHERE cc.CONSTRAINT_SCHEMA = DATABASE() 
          AND tc.TABLE_NAME = 'Companies'
      `, { transaction });
      
      const existingConstraintNames = existingConstraints.map(row => row.CONSTRAINT_NAME);
      console.log('Existing constraints before removal:', existingConstraintNames);
      
      for (const constraintName of constraintsToRemove) {
        if (existingConstraintNames.includes(constraintName)) {
          try {
            // Use raw SQL to drop check constraints since Sequelize sometimes has issues
            await queryInterface.sequelize.query(
              `ALTER TABLE Companies DROP CHECK ${constraintName}`,
              { transaction }
            );
            console.log(`Successfully removed constraint: ${constraintName}`);
          } catch (error) {
            console.error(`ERROR removing constraint ${constraintName}:`, error.message);
            // Don't throw - try to continue with other constraints
          }
        } else {
          console.log(`Constraint ${constraintName} does not exist, skipping`);
        }
      }
      
      // Verify all constraints were removed
      const [remainingConstraints] = await queryInterface.sequelize.query(`
        SELECT cc.CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
        JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc 
          ON cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME 
          AND cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
        WHERE cc.CONSTRAINT_SCHEMA = DATABASE() 
          AND tc.TABLE_NAME = 'Companies'
      `, { transaction });
      
      console.log('Remaining constraints after removal:', remainingConstraints.map(row => row.CONSTRAINT_NAME));
    });
  }
};