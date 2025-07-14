'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      console.log('Migrating user role enum values to foreign key relationships...');
      
      // First, create roles that match the enum values if they don't exist
      const enumRoleMapping = [
        { enum: 'client', name: 'Client', description: 'Client user role' },
        { enum: 'vendor_employee', name: 'Vendor Employee', description: 'Vendor employee role' },
        { enum: 'vendor_admin', name: 'Vendor Admin', description: 'Vendor administrator role' },
        { enum: 'acme_employee', name: 'Acme Employee', description: 'Acme employee role' },
        { enum: 'acme_admin', name: 'Acme Admin', description: 'Acme administrator role' },
        { enum: 'vendor_manager', name: 'Vendor Manager', description: 'Vendor manager role' },
        { enum: 'acme_manager', name: 'Acme Manager', description: 'Acme manager role' },
        { enum: 'team_member', name: 'Team Member', description: 'Team member role' },
        { enum: 'super_admin', name: 'Super Admin', description: 'Super administrator role' }
      ];

      // Create new roles based on enum values (if they don't exist)
      for (const roleInfo of enumRoleMapping) {
        const [existingRole] = await queryInterface.sequelize.query(
          'SELECT id FROM Roles WHERE name = ? AND company_id IS NULL',
          {
            replacements: [roleInfo.name],
            transaction
          }
        );

        if (existingRole.length === 0) {
          const roleId = require('crypto').randomUUID();
          await queryInterface.bulkInsert('Roles', [{
            id: roleId,
            name: roleInfo.name,
            description: roleInfo.description,
            company_id: null,
            is_system_role: true,
            created_at: new Date(),
            updated_at: new Date()
          }], { transaction });
          console.log(`Created role: ${roleInfo.name}`);
        }
      }

      // Now migrate users from enum role to role_id FK
      for (const roleInfo of enumRoleMapping) {
        console.log(`Migrating users with role: ${roleInfo.enum}`);
        
        // Get the role ID
        const [roleResult] = await queryInterface.sequelize.query(
          'SELECT id FROM Roles WHERE name = ? AND company_id IS NULL',
          {
            replacements: [roleInfo.name],
            transaction
          }
        );

        if (roleResult.length > 0) {
          const roleId = roleResult[0].id;
          
          // Update users with this enum role to use the FK
          const [updateResult] = await queryInterface.sequelize.query(
            'UPDATE Users SET role_id = ? WHERE role = ?',
            {
              replacements: [roleId, roleInfo.enum],
              transaction
            }
          );
          
          console.log(`Updated ${updateResult.affectedRows || 0} users with role ${roleInfo.enum}`);
        }
      }

      // Verify that all users have been migrated
      const [unmigrated] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM Users WHERE role_id IS NULL',
        { transaction }
      );
      
      if (unmigrated[0].count > 0) {
        console.warn(`Warning: ${unmigrated[0].count} users still have NULL role_id`);
      } else {
        console.log('All users successfully migrated to role_id foreign key');
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      console.log('Rolling back role FK migration - restoring enum values...');
      
      // Mapping from role names back to enum values
      const roleNameToEnum = {
        'Client': 'client',
        'Vendor Employee': 'vendor_employee',
        'Vendor Admin': 'vendor_admin',
        'Acme Employee': 'acme_employee',
        'Acme Admin': 'acme_admin',
        'Vendor Manager': 'vendor_manager',
        'Acme Manager': 'acme_manager',
        'Team Member': 'team_member',
        'Super Admin': 'super_admin'
      };

      // Get all users with their role names
      const [users] = await queryInterface.sequelize.query(`
        SELECT u.id, u.role_id, r.name as role_name 
        FROM Users u 
        LEFT JOIN Roles r ON u.role_id = r.id
        WHERE u.role_id IS NOT NULL
      `, { transaction });

      // Update each user back to enum value
      for (const user of users) {
        const enumValue = roleNameToEnum[user.role_name];
        if (enumValue) {
          await queryInterface.sequelize.query(
            'UPDATE Users SET role = ? WHERE id = ?',
            {
              replacements: [enumValue, user.id],
              transaction
            }
          );
        }
      }

      // Clear all role_id values
      await queryInterface.sequelize.query(
        'UPDATE Users SET role_id = NULL',
        { transaction }
      );

      console.log('Role FK migration rollback completed');
    });
  }
};