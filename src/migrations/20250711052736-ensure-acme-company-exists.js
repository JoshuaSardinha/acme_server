'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Fixed UUID for Acme company
      const ACME_ID = '00000000-0000-0000-0000-000000000001';
      const now = new Date();

      // Check if Acme company already exists (by ID or name)
      const [existingCompanyById] = await queryInterface.sequelize.query(
        'SELECT id FROM Companies WHERE id = :id',
        {
          replacements: { id: ACME_ID },
          type: queryInterface.sequelize.QueryTypes.SELECT,
          transaction,
        }
      );

      const [existingCompanyByName] = await queryInterface.sequelize.query(
        'SELECT id FROM Companies WHERE name = :name',
        {
          replacements: { name: 'Acme' },
          type: queryInterface.sequelize.QueryTypes.SELECT,
          transaction,
        }
      );

      if (!existingCompanyById && !existingCompanyByName) {
        // Insert the Acme company with fixed ID
        await queryInterface.bulkInsert(
          'Companies',
          [
            {
              id: ACME_ID,
              name: 'Acme',
              type: 'ACME',
              status: 'ACTIVE',
              email: 'team@acme.com',
              address: '123 Main Street, Suite 100, Anytown CA 12345',
              phone_number: '+1 (555) 123-4567',
              subdomain: 'acme',
              created_at: now,
              updated_at: now,
            },
          ],
          { transaction }
        );

        console.log('✓ Acme company created with fixed ID');
      } else if (existingCompanyById) {
        console.log('✓ Acme company already exists with correct ID');

        // Ensure the existing company has the correct properties
        await queryInterface.sequelize.query(
          `UPDATE Companies SET 
             name = :name,
             type = :type,
             status = :status,
             email = :email,
             address = :address,
             phone_number = :phone,
             subdomain = :subdomain,
             updated_at = :updatedAt
           WHERE id = :id`,
          {
            replacements: {
              id: ACME_ID,
              name: 'Acme',
              type: 'ACME',
              status: 'ACTIVE',
              email: 'team@acme.com',
              address: '123 Main Street, Suite 100, Anytown CA 12345',
              phone: '+1 (555) 123-4567',
              subdomain: 'acme',
              updatedAt: now,
            },
            transaction,
          }
        );

        console.log('✓ Acme company properties updated');
      } else if (existingCompanyByName) {
        console.log('✓ Acme company exists with different ID, updating to fixed ID');

        // Update the existing Acme company to use the fixed ID
        // First, temporarily update any foreign key references
        const oldId = existingCompanyByName.id;
        
        // Update Users table
        await queryInterface.sequelize.query(
          'UPDATE Users SET company_id = :newId WHERE company_id = :oldId',
          {
            replacements: { newId: ACME_ID, oldId },
            transaction,
          }
        );

        // Update Teams table
        await queryInterface.sequelize.query(
          'UPDATE Teams SET company_id = :newId WHERE company_id = :oldId',
          {
            replacements: { newId: ACME_ID, oldId },
            transaction,
          }
        );

        // Update any other tables that reference Companies
        // (Add more as needed based on your schema)

        // Delete the old company record
        await queryInterface.sequelize.query(
          'DELETE FROM Companies WHERE id = :oldId',
          {
            replacements: { oldId },
            transaction,
          }
        );

        // Insert the new company with fixed ID
        await queryInterface.bulkInsert(
          'Companies',
          [
            {
              id: ACME_ID,
              name: 'Acme',
              type: 'ACME',
              status: 'ACTIVE',
              email: 'team@acme.com',
              address: '123 Main Street, Suite 100, Anytown CA 12345',
              phone_number: '+1 (555) 123-4567',
              subdomain: 'acme',
              created_at: now,
              updated_at: now,
            },
          ],
          { transaction }
        );

        console.log('✓ Acme company ID standardized');
      }

      // Ensure no other company has ACME type
      await queryInterface.sequelize.query(
        'UPDATE Companies SET type = :vendorType WHERE type = :acmeType AND id != :acmeId',
        {
          replacements: {
            vendorType: 'VENDOR',
            acmeType: 'ACME',
            acmeId: ACME_ID,
          },
          transaction,
        }
      );

      console.log('✓ Ensured only Acme company has ACME type');
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // WARNING: This will remove the Acme company
      // Only use this in development/testing environments
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  Skipping Acme company removal in production');
        return;
      }

      const ACME_ID = '00000000-0000-0000-0000-000000000001';

      await queryInterface.sequelize.query(
        'DELETE FROM Companies WHERE id = :id',
        {
          replacements: { id: ACME_ID },
          transaction,
        }
      );

      console.log('⚠️  Acme company removed (development only)');
    });
  },
};
