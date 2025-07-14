'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      console.log('Starting role standardization migration...');
      
      // Step 1: Add the 'code' column to Roles table if it doesn't exist
      console.log('Checking if code column exists in Roles table...');
      const [columns] = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM Roles LIKE 'code'",
        { transaction }
      );
      
      if (columns.length === 0) {
        console.log('Adding code column to Roles table...');
        await queryInterface.addColumn('Roles', 'code', {
          type: Sequelize.STRING(50),
          allowNull: true, // Temporarily nullable for migration
          unique: true,
          comment: 'Unique snake_case identifier for the role'
        }, { transaction });
      } else {
        console.log('Code column already exists, skipping creation...');
      }

      // Step 2: Remove company_id and is_system_role columns if they exist
      console.log('Checking for company_id column in Roles table...');
      const [companyIdColumns] = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM Roles LIKE 'company_id'",
        { transaction }
      );
      
      if (companyIdColumns.length > 0) {
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
      } else {
        console.log('Company_id column does not exist, skipping removal...');
      }
      
      console.log('Checking for is_system_role column in Roles table...');
      const [systemRoleColumns] = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM Roles LIKE 'is_system_role'",
        { transaction }
      );
      
      if (systemRoleColumns.length > 0) {
        console.log('Removing is_system_role column from Roles table...');
        await queryInterface.removeColumn('Roles', 'is_system_role', { transaction });
      } else {
        console.log('Is_system_role column does not exist, skipping removal...');
      }

      // Step 3: Define the standard roles we want to keep
      const standardRoles = [
        { name: 'Super Admin', code: 'super_admin', description: 'Ultimate system administrator with all permissions' },
        { name: 'Client', code: 'client', description: 'Client company user' },
        { name: 'Acme Admin', code: 'acme_admin', description: 'Acme administrator' },
        { name: 'Acme Manager', code: 'acme_manager', description: 'Acme manager' },
        { name: 'Acme Employee', code: 'acme_employee', description: 'Acme employee' },
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
        // Check if this code is already assigned
        const [existingWithCode] = await queryInterface.sequelize.query(
          'SELECT id FROM Roles WHERE code = ?',
          { replacements: [standardRole.code], transaction }
        );

        if (existingWithCode.length > 0) {
          console.log(`Code ${standardRole.code} already exists, skipping...`);
          continue;
        }

        // Handle special cases for roles that might have conflicts
        if (standardRole.code === 'vendor_admin') {
          const vendorAdminRole = existingRoles.find(r => r.name === 'Vendor Admin');
          const companyAdminRole = existingRoles.find(r => r.name === 'Company Admin');
          
          if (vendorAdminRole && companyAdminRole) {
            // Merge Company Admin into Vendor Admin
            console.log(`Merging Company Admin into existing Vendor Admin role...`);
            
            // Update any users who have Company Admin role to use Vendor Admin role
            await queryInterface.sequelize.query(
              'UPDATE Users SET role_id = ? WHERE role_id = ?',
              { 
                replacements: [vendorAdminRole.id, companyAdminRole.id],
                transaction 
              }
            );
            
            // Update Vendor Admin role with code
            await queryInterface.sequelize.query(
              'UPDATE Roles SET code = ?, description = ?, updated_at = NOW() WHERE id = ?',
              { 
                replacements: [standardRole.code, standardRole.description, vendorAdminRole.id],
                transaction 
              }
            );
            
            // Delete Company Admin role
            await queryInterface.sequelize.query(
              'DELETE FROM Roles WHERE id = ?',
              { replacements: [companyAdminRole.id], transaction }
            );
            
            continue;
          } else if (vendorAdminRole) {
            // Just update existing Vendor Admin with code
            console.log(`Updating existing Vendor Admin role with code: ${standardRole.code}`);
            await queryInterface.sequelize.query(
              'UPDATE Roles SET code = ?, description = ?, updated_at = NOW() WHERE id = ?',
              { 
                replacements: [standardRole.code, standardRole.description, vendorAdminRole.id],
                transaction 
              }
            );
            continue;
          } else if (companyAdminRole) {
            // Rename Company Admin to Vendor Admin
            console.log(`Renaming Company Admin to Vendor Admin with code: ${standardRole.code}`);
            await queryInterface.sequelize.query(
              'UPDATE Roles SET code = ?, name = ?, description = ?, updated_at = NOW() WHERE id = ?',
              { 
                replacements: [standardRole.code, standardRole.name, standardRole.description, companyAdminRole.id],
                transaction 
              }
            );
            continue;
          }
        }

        // Handle vendor_manager conflicts
        if (standardRole.code === 'vendor_manager') {
          const vendorManagerRole = existingRoles.find(r => r.name === 'Vendor Manager');
          const teamManagerRole = existingRoles.find(r => r.name === 'Team Manager');
          
          if (vendorManagerRole && teamManagerRole) {
            // Merge Team Manager into Vendor Manager
            console.log(`Merging Team Manager into existing Vendor Manager role...`);
            
            // Update any users who have Team Manager role to use Vendor Manager role
            await queryInterface.sequelize.query(
              'UPDATE Users SET role_id = ? WHERE role_id = ?',
              { 
                replacements: [vendorManagerRole.id, teamManagerRole.id],
                transaction 
              }
            );
            
            // Update Vendor Manager role with code
            await queryInterface.sequelize.query(
              'UPDATE Roles SET code = ?, description = ?, updated_at = NOW() WHERE id = ?',
              { 
                replacements: [standardRole.code, standardRole.description, vendorManagerRole.id],
                transaction 
              }
            );
            
            // Delete Team Manager role
            await queryInterface.sequelize.query(
              'DELETE FROM Roles WHERE id = ?',
              { replacements: [teamManagerRole.id], transaction }
            );
            
            continue;
          } else if (vendorManagerRole) {
            // Just update existing Vendor Manager with code
            console.log(`Updating existing Vendor Manager role with code: ${standardRole.code}`);
            await queryInterface.sequelize.query(
              'UPDATE Roles SET code = ?, description = ?, updated_at = NOW() WHERE id = ?',
              { 
                replacements: [standardRole.code, standardRole.description, vendorManagerRole.id],
                transaction 
              }
            );
            continue;
          } else if (teamManagerRole) {
            // Rename Team Manager to Vendor Manager
            console.log(`Renaming Team Manager to Vendor Manager with code: ${standardRole.code}`);
            await queryInterface.sequelize.query(
              'UPDATE Roles SET code = ?, name = ?, description = ?, updated_at = NOW() WHERE id = ?',
              { 
                replacements: [standardRole.code, standardRole.name, standardRole.description, teamManagerRole.id],
                transaction 
              }
            );
            continue;
          }
        }

        // Handle vendor_employee conflicts  
        if (standardRole.code === 'vendor_employee') {
          const vendorEmployeeRole = existingRoles.find(r => r.name === 'Vendor Employee');
          const employeeRole = existingRoles.find(r => r.name === 'Employee');
          
          if (vendorEmployeeRole && employeeRole) {
            // Merge Employee into Vendor Employee
            console.log(`Merging Employee into existing Vendor Employee role...`);
            
            // Update any users who have Employee role to use Vendor Employee role
            await queryInterface.sequelize.query(
              'UPDATE Users SET role_id = ? WHERE role_id = ?',
              { 
                replacements: [vendorEmployeeRole.id, employeeRole.id],
                transaction 
              }
            );
            
            // Update Vendor Employee role with code
            await queryInterface.sequelize.query(
              'UPDATE Roles SET code = ?, description = ?, updated_at = NOW() WHERE id = ?',
              { 
                replacements: [standardRole.code, standardRole.description, vendorEmployeeRole.id],
                transaction 
              }
            );
            
            // Delete Employee role
            await queryInterface.sequelize.query(
              'DELETE FROM Roles WHERE id = ?',
              { replacements: [employeeRole.id], transaction }
            );
            
            continue;
          } else if (vendorEmployeeRole) {
            // Just update existing Vendor Employee with code
            console.log(`Updating existing Vendor Employee role with code: ${standardRole.code}`);
            await queryInterface.sequelize.query(
              'UPDATE Roles SET code = ?, description = ?, updated_at = NOW() WHERE id = ?',
              { 
                replacements: [standardRole.code, standardRole.description, vendorEmployeeRole.id],
                transaction 
              }
            );
            continue;
          } else if (employeeRole) {
            // Rename Employee to Vendor Employee
            console.log(`Renaming Employee to Vendor Employee with code: ${standardRole.code}`);
            await queryInterface.sequelize.query(
              'UPDATE Roles SET code = ?, name = ?, description = ?, updated_at = NOW() WHERE id = ?',
              { 
                replacements: [standardRole.code, standardRole.name, standardRole.description, employeeRole.id],
                transaction 
              }
            );
            continue;
          }
        }

        // More flexible matching logic for other roles
        const existingRole = existingRoles.find(r => {
          const normalizedName = r.name.toLowerCase().replace(/[\s-]+/g, '_');
          return normalizedName === standardRole.code ||
                 r.name.toLowerCase() === standardRole.name.toLowerCase();
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
