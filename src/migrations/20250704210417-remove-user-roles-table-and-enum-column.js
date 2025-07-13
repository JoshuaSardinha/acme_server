'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      console.log('Removing UserRoles table and old role enum column...');
      
      // 1. Make role_id NOT NULL since all users should have been migrated
      console.log('Making role_id column NOT NULL...');
      await queryInterface.changeColumn('Users', 'role_id', {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Roles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT', // Don't allow deleting roles that are assigned to users
        comment: 'Foreign key to Roles table - replaces role enum'
      }, { transaction });

      // 2. Drop the UserRoles table (no longer needed)
      console.log('Dropping UserRoles table...');
      await queryInterface.dropTable('UserRoles', { transaction });

      // 3. Remove the old role enum column
      console.log('Removing old role enum column...');
      await queryInterface.removeColumn('Users', 'role', { transaction });

      console.log('User role refactoring completed successfully');
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      console.log('Restoring UserRoles table and role enum column...');
      
      // 1. Add back the role enum column
      await queryInterface.addColumn('Users', 'role', {
        type: Sequelize.ENUM(
          'client',
          'vendor_employee',
          'vendor_admin',
          'national_niner_employee',
          'national_niner_admin',
          'vendor_manager',
          'national_niner_manager',
          'team_member',
          'super_admin'
        ),
        allowNull: false,
        defaultValue: 'client'
      }, { transaction });

      // 2. Recreate UserRoles table
      await queryInterface.createTable('UserRoles', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        role_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Roles',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        granted_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
          comment: 'User who granted this role',
        },
        granted_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
      }, { transaction });

      // Add indexes back
      await queryInterface.addIndex('UserRoles', ['user_id', 'role_id'], {
        unique: true,
        name: 'unique_user_role',
        transaction
      });
      await queryInterface.addIndex('UserRoles', ['user_id'], { transaction });
      await queryInterface.addIndex('UserRoles', ['role_id'], { transaction });
      await queryInterface.addIndex('UserRoles', ['granted_by'], { transaction });

      // 3. Make role_id nullable again (for backward compatibility)
      await queryInterface.changeColumn('Users', 'role_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Roles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction });

      console.log('UserRoles table and role enum column restored');
    });
  }
};