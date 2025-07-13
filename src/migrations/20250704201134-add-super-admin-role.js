'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Check if Super Admin role already exists
      const [existingRole] = await queryInterface.sequelize.query(
        'SELECT id FROM Roles WHERE id = ? OR name = ?',
        { 
          replacements: ['00000000-0000-0000-0000-000000001000', 'Super Admin'],
          transaction 
        }
      );

      if (existingRole.length > 0) {
        console.log('Super Admin role already exists, skipping creation...');
        return;
      }

      // Insert Super Admin role
      const superAdminRole = {
        id: '00000000-0000-0000-0000-000000001000', // Use a lower ID to ensure it's first
        name: 'Super Admin',
        description: 'Ultimate system administrator with all permissions and ability to bypass company restrictions',
        company_id: null,
        is_system_role: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await queryInterface.bulkInsert('Roles', [superAdminRole], { transaction });

      // Get all existing permissions
      const [permissions] = await queryInterface.sequelize.query(
        'SELECT id FROM Permissions',
        { transaction }
      );

      // Assign ALL permissions to Super Admin role
      const superAdminPermissions = permissions.map(permission => ({
        id: require('crypto').randomUUID(),
        role_id: superAdminRole.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      await queryInterface.bulkInsert('RolePermissions', superAdminPermissions, { transaction });

      // Add additional super admin specific permissions
      const superAdminSpecificPermissions = [
        {
          id: '00000000-0000-0000-0000-000000000050',
          name: 'super_admin.bypass_company_restrictions',
          description: 'Can bypass company-level restrictions and access all data',
          category: 'super_admin',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '00000000-0000-0000-0000-000000000051',
          name: 'super_admin.manage_system_roles',
          description: 'Can manage system-wide roles and permissions',
          category: 'super_admin',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '00000000-0000-0000-0000-000000000052',
          name: 'super_admin.access_all_companies',
          description: 'Can access and manage all companies in the system',
          category: 'super_admin',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '00000000-0000-0000-0000-000000000053',
          name: 'super_admin.manage_super_admins',
          description: 'Can grant/revoke super admin privileges',
          category: 'super_admin',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      await queryInterface.bulkInsert('Permissions', superAdminSpecificPermissions, { transaction });

      // Assign these new permissions to Super Admin role
      const newSuperAdminPermissions = superAdminSpecificPermissions.map(permission => ({
        id: require('crypto').randomUUID(),
        role_id: superAdminRole.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      await queryInterface.bulkInsert('RolePermissions', newSuperAdminPermissions, { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Remove Super Admin role permissions
      await queryInterface.bulkDelete('RolePermissions', {
        role_id: '00000000-0000-0000-0000-000000001000'
      }, { transaction });

      // Remove Super Admin role
      await queryInterface.bulkDelete('Roles', {
        id: '00000000-0000-0000-0000-000000001000'
      }, { transaction });

      // Remove super admin specific permissions
      await queryInterface.bulkDelete('Permissions', {
        id: {
          [Sequelize.Op.in]: [
            '00000000-0000-0000-0000-000000000050',
            '00000000-0000-0000-0000-000000000051',
            '00000000-0000-0000-0000-000000000052',
            '00000000-0000-0000-0000-000000000053',
          ]
        }
      }, { transaction });
    });
  },
};
