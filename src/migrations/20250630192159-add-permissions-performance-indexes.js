'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Check existing indexes to avoid conflicts
      const checkIndexExists = async (tableName, indexName) => {
        try {
          const indexes = await queryInterface.showIndex(tableName);
          return indexes.some(index => index.name === indexName);
        } catch (error) {
          console.warn(`Could not check indexes for table ${tableName}:`, error.message);
          return false;
        }
      };

      // Indexes for permission queries performance (using correct PascalCase table names)
      
      // User-Role relationship index (compound unique) - check if unique constraint already exists
      if (!(await checkIndexExists('UserRoles', 'idx_user_roles_user_role'))) {
        console.log('Adding UserRoles compound index...');
        await queryInterface.addIndex('UserRoles', ['user_id', 'role_id'], {
          name: 'idx_user_roles_user_role',
          unique: true,
          transaction
        });
      }
      
      // Role-Permission relationship index (compound unique)
      if (!(await checkIndexExists('RolePermissions', 'idx_role_permissions_role_permission'))) {
        console.log('Adding RolePermissions compound index...');
        await queryInterface.addIndex('RolePermissions', ['role_id', 'permission_id'], {
          name: 'idx_role_permissions_role_permission',
          unique: true,
          transaction
        });
      }
      
      // User-Permission direct relationship index (compound unique)
      if (!(await checkIndexExists('UserPermissions', 'idx_user_permissions_user_permission'))) {
        console.log('Adding UserPermissions compound index...');
        await queryInterface.addIndex('UserPermissions', ['user_id', 'permission_id'], {
          name: 'idx_user_permissions_user_permission',
          unique: true,
          transaction
        });
      }
      
      // Company isolation indexes for multi-tenant queries
      if (!(await checkIndexExists('Roles', 'idx_roles_company_name'))) {
        console.log('Adding Roles company+name index...');
        await queryInterface.addIndex('Roles', ['company_id', 'name'], {
          name: 'idx_roles_company_name',
          transaction
        });
      }
      
      if (!(await checkIndexExists('Users', 'idx_users_company_role'))) {
        console.log('Adding Users company+role index...');
        await queryInterface.addIndex('Users', ['company_id', 'role'], {
          name: 'idx_users_company_role',
          transaction
        });
      }
      
      // Permission lookups by user for caching
      if (!(await checkIndexExists('UserRoles', 'idx_user_roles_user_id'))) {
        console.log('Adding UserRoles user_id index...');
        await queryInterface.addIndex('UserRoles', ['user_id'], {
          name: 'idx_user_roles_user_id',
          transaction
        });
      }
      
      // Role lookups by company for role-based permission queries
      if (!(await checkIndexExists('Roles', 'idx_roles_company_id'))) {
        console.log('Adding Roles company_id index...');
        await queryInterface.addIndex('Roles', ['company_id'], {
          name: 'idx_roles_company_id',
          transaction
        });
      }
      
      // User permission granted status lookup
      if (!(await checkIndexExists('UserPermissions', 'idx_user_permissions_user_granted'))) {
        console.log('Adding UserPermissions user+granted index...');
        await queryInterface.addIndex('UserPermissions', ['user_id', 'granted'], {
          name: 'idx_user_permissions_user_granted',
          transaction
        });
      }
      
      console.log('Permissions performance indexes added successfully');
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Remove all indexes in reverse order (graceful removal)
      const indexesToRemove = [
        { table: 'UserPermissions', name: 'idx_user_permissions_user_granted' },
        { table: 'Roles', name: 'idx_roles_company_id' },
        { table: 'UserRoles', name: 'idx_user_roles_user_id' },
        { table: 'Users', name: 'idx_users_company_role' },
        { table: 'Roles', name: 'idx_roles_company_name' },
        { table: 'UserPermissions', name: 'idx_user_permissions_user_permission' },
        { table: 'RolePermissions', name: 'idx_role_permissions_role_permission' },
        { table: 'UserRoles', name: 'idx_user_roles_user_role' }
      ];

      for (const { table, name } of indexesToRemove) {
        try {
          await queryInterface.removeIndex(table, name, { transaction });
          console.log(`Removed index ${name} from ${table}`);
        } catch (error) {
          console.warn(`Could not remove index ${name} from ${table}:`, error.message);
        }
      }
    });
  }
};