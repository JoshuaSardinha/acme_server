'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      console.log('Adding role_id foreign key column to Users table...');
      
      // 1. Add the new role_id column to Users table
      await queryInterface.addColumn('Users', 'role_id', {
        type: Sequelize.UUID,
        allowNull: true, // Initially nullable for migration
        references: {
          model: 'Roles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Foreign key to Roles table - replaces role enum'
      }, { transaction });

      // 2. Add index for role_id lookups
      await queryInterface.addIndex('Users', ['role_id'], {
        name: 'idx_users_role_id',
        comment: 'Index for role-based user queries',
        transaction
      });

      console.log('Role ID foreign key column added successfully');
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      console.log('Removing role_id foreign key column from Users table...');
      
      // Get current table structure before removing
      const tableDescription = await queryInterface.describeTable('Users');
      
      // Remove index first
      try {
        await queryInterface.removeIndex('Users', 'idx_users_role_id', { transaction });
      } catch (error) {
        console.warn('Could not remove index idx_users_role_id:', error.message);
      }

      // Remove the column if it exists
      if (tableDescription.role_id) {
        console.log("Removing 'role_id' column from Users table...");
        await queryInterface.removeColumn('Users', 'role_id', { transaction });
      } else {
        console.log("'role_id' column does not exist in Users table, skipping removal.");
      }
    });
  }
};