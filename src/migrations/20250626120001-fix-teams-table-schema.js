'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Get current table structure to make migration idempotent
      const tableDescription = await queryInterface.describeTable('Teams');
      
      // Add missing columns to Teams table per REQ-TEAM-001
      
      // Add description column if it doesn't exist
      if (!tableDescription.description) {
        console.log("Adding 'description' column to Teams table...");
        await queryInterface.addColumn('Teams', 'description', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Optional text description of the team'
        });
      } else {
        console.log("'description' column already exists in Teams table. Skipping.");
      }
      
      // Add category column if it doesn't exist
      if (!tableDescription.category) {
        console.log("Adding 'category' column to Teams table...");
        await queryInterface.addColumn('Teams', 'category', {
          type: Sequelize.ENUM('LEGAL', 'CONVENTIONAL'),
          allowNull: false,
          defaultValue: 'CONVENTIONAL',
          comment: 'Team category for assignment rules'
        });
      } else {
        console.log("'category' column already exists in Teams table. Skipping.");
      }
      
      // Add is_active column if it doesn't exist
      if (!tableDescription.is_active) {
        console.log("Adding 'is_active' column to Teams table...");
        await queryInterface.addColumn('Teams', 'is_active', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Whether the team is active'
        });
      } else {
        console.log("'is_active' column already exists in Teams table. Skipping.");
      }
      
      // Rename manager_id to owner_user_id per REQ-TEAM-001 if needed
      if (tableDescription.manager_id && !tableDescription.owner_user_id) {
        console.log("Renaming 'manager_id' to 'owner_user_id' in Teams table...");
        
        // Use transaction to ensure all steps succeed or fail together
        await queryInterface.sequelize.transaction(async (transaction) => {
          // Step 1: Find and drop the existing foreign key constraint
          // Query to find the actual constraint name
          const [constraints] = await queryInterface.sequelize.query(
            `SELECT CONSTRAINT_NAME 
             FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
             WHERE TABLE_NAME = 'Teams' 
               AND COLUMN_NAME = 'manager_id' 
               AND REFERENCED_TABLE_NAME = 'Users'
               AND TABLE_SCHEMA = DATABASE()`,
            { transaction }
          );
          
          if (constraints.length > 0) {
            const constraintName = constraints[0].CONSTRAINT_NAME;
            console.log(`Found foreign key constraint: ${constraintName}`);
            await queryInterface.removeConstraint('Teams', constraintName, { transaction });
          } else {
            console.log("Warning: No foreign key constraint found for manager_id. Proceeding without dropping constraint.");
          }
          
          // Step 2: Rename the column
          await queryInterface.renameColumn('Teams', 'manager_id', 'owner_user_id', { transaction });
          
          // Step 3: Add the foreign key constraint back on the new column
          // Note: Since teams require an owner (per REQ-TEAM-001), we use CASCADE instead of SET NULL
          await queryInterface.addConstraint('Teams', {
            type: 'foreign key',
            fields: ['owner_user_id'],
            name: 'teams_owner_user_id_fk',
            references: {
              table: 'Users',
              field: 'id',
            },
            onDelete: 'CASCADE',  // Teams without owners should be deleted
            onUpdate: 'CASCADE',
            transaction,
          });
        });
      } else if (tableDescription.owner_user_id) {
        console.log("'owner_user_id' column already exists in Teams table. Skipping rename.");
      } else {
        console.log("Neither 'manager_id' nor 'owner_user_id' found. This may indicate an unexpected table state.");
      }
      
      // Check existing indexes to avoid duplicates
      const indexes = await queryInterface.showIndex('Teams');
      const existingIndexNames = indexes.map(index => index.name);
      
      // Add unique constraint on (company_id, name) per REQ-TEAM-001
      if (!existingIndexNames.includes('unique_team_name_per_company')) {
        console.log("Adding unique constraint on (company_id, name)...");
        await queryInterface.addIndex('Teams', ['company_id', 'name'], {
          unique: true,
          name: 'unique_team_name_per_company'
        });
      } else {
        console.log("Index 'unique_team_name_per_company' already exists. Skipping.");
      }
      
      // Add indexes for performance
      if (!existingIndexNames.includes('idx_teams_category')) {
        console.log("Adding index on category...");
        await queryInterface.addIndex('Teams', ['category'], {
          name: 'idx_teams_category'
        });
      } else {
        console.log("Index 'idx_teams_category' already exists. Skipping.");
      }
      
      if (!existingIndexNames.includes('idx_teams_is_active')) {
        console.log("Adding index on is_active...");
        await queryInterface.addIndex('Teams', ['is_active'], {
          name: 'idx_teams_is_active'
        });
      } else {
        console.log("Index 'idx_teams_is_active' already exists. Skipping.");
      }
      
      // Add composite index for common queries
      if (!existingIndexNames.includes('idx_teams_company_category_active')) {
        console.log("Adding composite index on (company_id, category, is_active)...");
        await queryInterface.addIndex('Teams', ['company_id', 'category', 'is_active'], {
          name: 'idx_teams_company_category_active'
        });
      } else {
        console.log("Index 'idx_teams_company_category_active' already exists. Skipping.");
      }
      
    } catch (error) {
      console.error('Error in Teams table migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove indexes - handle gracefully if they don't exist
      const indexes = await queryInterface.showIndex('Teams');
      const existingIndexNames = indexes.map(index => index.name);
      
      if (existingIndexNames.includes('idx_teams_company_category_active')) {
        await queryInterface.removeIndex('Teams', 'idx_teams_company_category_active');
      }
      if (existingIndexNames.includes('idx_teams_is_active')) {
        await queryInterface.removeIndex('Teams', 'idx_teams_is_active');
      }
      if (existingIndexNames.includes('idx_teams_category')) {
        await queryInterface.removeIndex('Teams', 'idx_teams_category');
      }
      if (existingIndexNames.includes('unique_team_name_per_company')) {
        await queryInterface.removeIndex('Teams', 'unique_team_name_per_company');
      }
      
      // Rename owner_user_id back to manager_id with proper foreign key handling
      const tableDescription = await queryInterface.describeTable('Teams');
      if (tableDescription.owner_user_id) {
        await queryInterface.sequelize.transaction(async (transaction) => {
          // Find and drop the new foreign key constraint
          const [constraints] = await queryInterface.sequelize.query(
            `SELECT CONSTRAINT_NAME 
             FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
             WHERE TABLE_NAME = 'Teams' 
               AND COLUMN_NAME = 'owner_user_id' 
               AND REFERENCED_TABLE_NAME = 'Users'
               AND TABLE_SCHEMA = DATABASE()`,
            { transaction }
          );
          
          if (constraints.length > 0) {
            const constraintName = constraints[0].CONSTRAINT_NAME;
            console.log(`Found foreign key constraint to remove: ${constraintName}`);
            await queryInterface.removeConstraint('Teams', constraintName, { transaction });
          }
          
          // Rename the column back
          await queryInterface.renameColumn('Teams', 'owner_user_id', 'manager_id', { transaction });
          
          // Add the original foreign key constraint back
          await queryInterface.addConstraint('Teams', {
            type: 'foreign key',
            fields: ['manager_id'],
            references: {
              table: 'Users',
              field: 'id',
            },
            onDelete: 'CASCADE',  // Match the original constraint behavior
            onUpdate: 'CASCADE',
            transaction,
          });
        });
      }
      
      // Remove columns
      await queryInterface.removeColumn('Teams', 'is_active');
      await queryInterface.removeColumn('Teams', 'category');
      await queryInterface.removeColumn('Teams', 'description');
      
    } catch (error) {
      console.error('Error in Teams table migration rollback:', error);
      throw error;
    }
  }
};