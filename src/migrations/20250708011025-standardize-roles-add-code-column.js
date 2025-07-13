'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      console.log('Starting role standardization migration...');
      
      // Step 1: Add the 'code' column to Roles table
      console.log('Adding code column to Roles table...');
      await queryInterface.addColumn('Roles', 'code', {
        type: Sequelize.STRING(50),
        allowNull: true, // Temporarily nullable for migration
        unique: true,
        comment: 'Unique snake_case identifier for the role'
      }, { transaction });

      // Step 2: Remove company_id and is_system_role columns
      console.log('Removing company_id column from Roles table...');
      
      // First, find and remove the foreign key constraint
      const [constraints] = await queryInterface.sequelize.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_NAME = 'Roles' 
          AND COLUMN_NAME = 'company_id' 
          AND REFERENCED_TABLE_NAME = 'Companies'
          AND TABLE_SCHEMA = DATABASE()
      `, { transaction });
      
      if (constraints.length > 0) {
        await queryInterface.removeConstraint('Roles', constraints[0].CONSTRAINT_NAME, { transaction });
      }
      
      await queryInterface.removeColumn('Roles', 'company_id', { transaction });
      
      console.log('Removing is_system_role column from Roles table...');
      await queryInterface.removeColumn('Roles', 'is_system_role', { transaction });

      // Step 3: Define the standard roles we want to keep
      const standardRoles = [
        { name: 'Super Admin', code: 'super_admin', description: 'Ultimate system administrator with all permissions' },
        { name: 'Client', code: 'client', description: 'Client company user' },
        { name: 'National Niner Admin', code: 'national_niner_admin', description: 'National Niner administrator' },
        { name: 'National Niner Manager', code: 'national_niner_manager', description: 'National Niner manager' },
        { name: 'National Niner Employee', code: 'national_niner_employee', description: 'National Niner employee' },
        { name: 'Vendor Admin', code: 'vendor_admin', description: 'Vendor company administrator' },
        { name: 'Vendor Manager', code: 'vendor_manager', description: 'Vendor company manager' },
        { name: 'Vendor Employee', code: 'vendor_employee', description: 'Vendor company employee' }
      ];

      // Step 4: Get existing roles
      const [existingRoles] = await queryInterface.sequelize.query(
        'SELECT id, name FROM Roles',
        { transaction }
      );

      console.log('Existing roles:', existingRoles);

      // Step 5: Update existing roles with codes or create new ones
      for (const standardRole of standardRoles) {
        // More flexible matching logic
        const existingRole = existingRoles.find(r => {
          const normalizedName = r.name.toLowerCase().replace(/[\s-]+/g, '_');
          return normalizedName === standardRole.code ||
                 r.name.toLowerCase() === standardRole.name.toLowerCase() ||
                 (standardRole.code === 'vendor_admin' && r.name === 'Company Admin') ||
                 (standardRole.code === 'vendor_employee' && r.name === 'Employee') ||
                 (standardRole.code === 'vendor_manager' && r.name === 'Team Manager');
        });

        if (existingRole) {
          console.log(`Updating role: ${existingRole.name} with code: ${standardRole.code}`);
          await queryInterface.sequelize.query(
            'UPDATE Roles SET code = ?, name = ?, description = ?, updated_at = NOW() WHERE id = ?',
            { 
              replacements: [standardRole.code, standardRole.name, standardRole.description, existingRole.id],
              transaction 
            }
          );
        } else {
          console.log(`Creating new role: ${standardRole.name} with code: ${standardRole.code}`);
          await queryInterface.bulkInsert('Roles', [{
            id: require('crypto').randomUUID(),
            name: standardRole.name,
            code: standardRole.code,
            description: standardRole.description,
            created_at: new Date(),
            updated_at: new Date()
          }], { transaction });
        }
      }

      // Step 5b: Handle any remaining roles that didn't match our standard roles
      const [remainingRoles] = await queryInterface.sequelize.query(
        'SELECT id, name FROM Roles WHERE code IS NULL',
        { transaction }
      );

      console.log('Remaining roles without codes:', remainingRoles);
      
      // Give them temporary codes based on their names
      for (const role of remainingRoles) {
        const tempCode = role.name.toLowerCase().replace(/[\s-]+/g, '_');
        console.log(`Assigning temporary code ${tempCode} to role: ${role.name}`);
        await queryInterface.sequelize.query(
          'UPDATE Roles SET code = ?, updated_at = NOW() WHERE id = ?',
          { 
            replacements: [tempCode, role.id],
            transaction 
          }
        );
      }

      // Step 6: Delete any roles not in our standard list
      const standardRoleCodes = standardRoles.map(r => r.code);
      console.log('Removing non-standard roles...');
      
      // First update users with non-standard roles to 'client' role
      const [clientRole] = await queryInterface.sequelize.query(
        'SELECT id FROM Roles WHERE code = ?',
        { replacements: ['client'], transaction }
      );
      
      if (clientRole.length > 0) {
        await queryInterface.sequelize.query(
          `UPDATE Users 
           SET role_id = ?, updated_at = NOW() 
           WHERE role_id IN (
             SELECT id FROM Roles WHERE code NOT IN (${standardRoleCodes.map(() => '?').join(',')})
           )`,
          { 
            replacements: [clientRole[0].id, ...standardRoleCodes],
            transaction 
          }
        );
      }
      
      // Delete non-standard roles
      await queryInterface.sequelize.query(
        `DELETE FROM RolePermissions WHERE role_id IN (
          SELECT id FROM Roles WHERE code NOT IN (${standardRoleCodes.map(() => '?').join(',')})
        )`,
        { replacements: standardRoleCodes, transaction }
      );
      
      await queryInterface.sequelize.query(
        `DELETE FROM Roles WHERE code NOT IN (${standardRoleCodes.map(() => '?').join(',')})`,
        { replacements: standardRoleCodes, transaction }
      );

      // Step 7: Make code column NOT NULL after all updates
      console.log('Making code column NOT NULL...');
      await queryInterface.changeColumn('Roles', 'code', {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Unique snake_case identifier for the role'
      }, { transaction });

      console.log('Role standardization completed successfully');
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      console.log('Reverting role standardization...');
      
      // Step 1: Add back company_id and is_system_role columns
      await queryInterface.addColumn('Roles', 'company_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Companies',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction });
      
      await queryInterface.addColumn('Roles', 'is_system_role', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }, { transaction });
      
      // Step 2: Update all roles to be system roles
      await queryInterface.sequelize.query(
        'UPDATE Roles SET is_system_role = true',
        { transaction }
      );
      
      // Step 3: Remove the code column
      await queryInterface.removeColumn('Roles', 'code', { transaction });
      
      console.log('Role standardization reverted');
    });
  }
};
