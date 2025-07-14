'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Get current table structure to make migration idempotent
      const tableDescription = await queryInterface.describeTable('TeamMembers');
      
      // Add missing audit columns to TeamMembers table per REQ-TEAM-002
      
      // Add added_at column if it doesn't exist
      if (!tableDescription.added_at) {
        console.log("Adding 'added_at' column to TeamMembers table...");
        await queryInterface.addColumn('TeamMembers', 'added_at', {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
          comment: 'Timestamp when the member was added to the team'
        });
      } else {
        console.log("'added_at' column already exists in TeamMembers table. Skipping.");
      }
      
      // Add added_by_user_id column if it doesn't exist
      if (!tableDescription.added_by_user_id) {
        console.log("Adding 'added_by_user_id' column to TeamMembers table...");
        await queryInterface.addColumn('TeamMembers', 'added_by_user_id', {
          type: Sequelize.UUID,
          allowNull: false,
          comment: 'User who added this member to the team',
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        });
      } else {
        console.log("'added_by_user_id' column already exists in TeamMembers table. Skipping.");
      }
      
      // Check existing indexes to avoid duplicates
      const indexes = await queryInterface.showIndex('TeamMembers');
      const existingIndexNames = indexes.map(index => index.name);
      
      // Add indexes for performance on audit columns
      if (!existingIndexNames.includes('idx_team_members_added_at')) {
        console.log("Adding index on added_at...");
        await queryInterface.addIndex('TeamMembers', ['added_at'], {
          name: 'idx_team_members_added_at'
        });
      } else {
        console.log("Index 'idx_team_members_added_at' already exists. Skipping.");
      }
      
      if (!existingIndexNames.includes('idx_team_members_added_by_user_id')) {
        console.log("Adding index on added_by_user_id...");
        await queryInterface.addIndex('TeamMembers', ['added_by_user_id'], {
          name: 'idx_team_members_added_by_user_id'
        });
      } else {
        console.log("Index 'idx_team_members_added_by_user_id' already exists. Skipping.");
      }
      
      // Add composite index for audit queries
      if (!existingIndexNames.includes('idx_team_members_team_added_at')) {
        console.log("Adding composite index on (team_id, added_at)...");
        await queryInterface.addIndex('TeamMembers', ['team_id', 'added_at'], {
          name: 'idx_team_members_team_added_at'
        });
      } else {
        console.log("Index 'idx_team_members_team_added_at' already exists. Skipping.");
      }
      
      // Ensure the unique constraint exists on (team_id, user_id) per REQ-TEAM-002
      const hasUniqueConstraint = existingIndexNames.includes('unique_team_user_membership') ||
        indexes.some(index => 
          index.unique && 
          index.fields.some(field => field.attribute === 'team_id') &&
          index.fields.some(field => field.attribute === 'user_id')
        );
      
      if (!hasUniqueConstraint) {
        console.log("Adding unique constraint on (team_id, user_id)...");
        await queryInterface.addIndex('TeamMembers', ['team_id', 'user_id'], {
          unique: true,
          name: 'unique_team_user_membership'
        });
      } else {
        console.log("Unique constraint on (team_id, user_id) already exists. Skipping.");
      }
      
      // Update existing TeamMember records to have a default added_by_user_id if the column was just added
      if (!tableDescription.added_by_user_id) {
        console.log("Updating existing TeamMember records with default added_by_user_id...");
        await queryInterface.sequelize.query(`
          UPDATE TeamMembers tm
          JOIN Teams t ON tm.team_id = t.id
          SET tm.added_by_user_id = t.owner_user_id
          WHERE tm.added_by_user_id IS NULL
        `);
      }
      
    } catch (error) {
      console.error('Error in TeamMembers table migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Get existing indexes before attempting to remove them
      const indexes = await queryInterface.showIndex('TeamMembers');
      const existingIndexNames = indexes.map(index => index.name);
      
      // Get current table structure before removing columns
      const tableDescription = await queryInterface.describeTable('TeamMembers');
      
      // Remove indexes that don't depend on foreign keys first
      if (existingIndexNames.includes('idx_team_members_team_added_at')) {
        console.log("Removing index 'idx_team_members_team_added_at'...");
        await queryInterface.removeIndex('TeamMembers', 'idx_team_members_team_added_at');
      }
      
      if (existingIndexNames.includes('idx_team_members_added_at')) {
        console.log("Removing index 'idx_team_members_added_at'...");
        await queryInterface.removeIndex('TeamMembers', 'idx_team_members_added_at');
      }
      
      // Remove columns if they exist (this will automatically remove foreign key constraints and related indexes)
      if (tableDescription.added_by_user_id) {
        console.log("Removing 'added_by_user_id' column (this will remove the FK constraint and its index)...");
        await queryInterface.removeColumn('TeamMembers', 'added_by_user_id');
      }
      
      if (tableDescription.added_at) {
        console.log("Removing 'added_at' column...");
        await queryInterface.removeColumn('TeamMembers', 'added_at');
      }
      
      // Note: We don't remove the unique constraint as it may have existed before this migration
      
    } catch (error) {
      console.error('Error in TeamMembers table migration rollback:', error);
      throw error;
    }
  }
};