'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Get current table structure to make migration idempotent
      const tableDescription = await queryInterface.describeTable('Companies');
      
      // Add missing columns to Companies table per REQ-COMP-001
      
      // Add type column (ENUM: 'ACME', 'VENDOR') if it doesn't exist
      if (!tableDescription.type) {
        console.log("Adding 'type' column to Companies table...");
        await queryInterface.addColumn('Companies', 'type', {
          type: Sequelize.ENUM('ACME', 'VENDOR'),
          allowNull: false,
          defaultValue: 'VENDOR',
          comment: 'Company type: Acme or Vendor company'
        });
      } else {
        console.log("'type' column already exists in Companies table. Skipping.");
      }
      
      // Add status column (ENUM: 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED') if it doesn't exist
      if (!tableDescription.status) {
        console.log("Adding 'status' column to Companies table...");
        await queryInterface.addColumn('Companies', 'status', {
          type: Sequelize.ENUM('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED'),
          allowNull: false,
          defaultValue: 'PENDING_APPROVAL',
          comment: 'Company status for vendor approval workflow'
        });
      } else {
        console.log("'status' column already exists in Companies table. Skipping.");
      }
      
      // Add billing_plan_id column if it doesn't exist
      if (!tableDescription.billing_plan_id) {
        console.log("Adding 'billing_plan_id' column to Companies table...");
        await queryInterface.addColumn('Companies', 'billing_plan_id', {
          type: Sequelize.UUID,
          allowNull: true,
          comment: 'Reference to billing plan (for vendors) - FK constraint to be added later'
        });
      } else {
        console.log("'billing_plan_id' column already exists in Companies table. Skipping.");
      }
      
      // Add primary_contact_user_id column if it doesn't exist
      if (!tableDescription.primary_contact_user_id) {
        console.log("Adding 'primary_contact_user_id' column to Companies table...");
        await queryInterface.addColumn('Companies', 'primary_contact_user_id', {
          type: Sequelize.UUID,
          allowNull: true,
          comment: 'Primary contact user for the company',
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        });
      } else {
        console.log("'primary_contact_user_id' column already exists in Companies table. Skipping.");
      }
      
      // Add submitted_documents_ref column if it doesn't exist
      if (!tableDescription.submitted_documents_ref) {
        console.log("Adding 'submitted_documents_ref' column to Companies table...");
        await queryInterface.addColumn('Companies', 'submitted_documents_ref', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Reference to stored documents for verification (for vendors)'
        });
      } else {
        console.log("'submitted_documents_ref' column already exists in Companies table. Skipping.");
      }
      
      // Add subdomain column if it doesn't exist (for white-label vendors)
      if (!tableDescription.subdomain) {
        console.log("Adding 'subdomain' column to Companies table...");
        await queryInterface.addColumn('Companies', 'subdomain', {
          type: Sequelize.STRING,
          allowNull: true,
          unique: true,
          comment: 'Subdomain for white-label vendor instances'
        });
      } else {
        console.log("'subdomain' column already exists in Companies table. Skipping.");
      }
      
      // Check existing indexes to avoid duplicates
      const indexes = await queryInterface.showIndex('Companies');
      const existingIndexNames = indexes.map(index => index.name);
      
      // Add unique constraint on company name per REQ-COMP-001
      if (!existingIndexNames.includes('unique_company_name')) {
        console.log("Adding unique index on company name...");
        await queryInterface.addIndex('Companies', ['name'], {
          unique: true,
          name: 'unique_company_name'
        });
      } else {
        console.log("Index 'unique_company_name' already exists. Skipping.");
      }
      
      // Add indexes for performance on foreign key columns
      if (!existingIndexNames.includes('idx_companies_billing_plan_id')) {
        console.log("Adding index on billing_plan_id...");
        await queryInterface.addIndex('Companies', ['billing_plan_id'], {
          name: 'idx_companies_billing_plan_id'
        });
      } else {
        console.log("Index 'idx_companies_billing_plan_id' already exists. Skipping.");
      }
      
      if (!existingIndexNames.includes('idx_companies_primary_contact_user_id')) {
        console.log("Adding index on primary_contact_user_id...");
        await queryInterface.addIndex('Companies', ['primary_contact_user_id'], {
          name: 'idx_companies_primary_contact_user_id'
        });
      } else {
        console.log("Index 'idx_companies_primary_contact_user_id' already exists. Skipping.");
      }
      
      // Add composite index for type and status queries
      if (!existingIndexNames.includes('idx_companies_type_status')) {
        console.log("Adding composite index on type and status...");
        await queryInterface.addIndex('Companies', ['type', 'status'], {
          name: 'idx_companies_type_status'
        });
      } else {
        console.log("Index 'idx_companies_type_status' already exists. Skipping.");
      }
      
      // Update existing Acme company to have correct type
      await queryInterface.bulkUpdate('Companies', 
        { 
          type: 'ACME',
          status: 'ACTIVE'
        }, 
        { 
          id: '82ed6abb-a2cd-4384-b62f-1c90a685831f' 
        }
      );
      
    } catch (error) {
      console.error('Error in Companies table migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      try {
        // Get existing indexes before attempting to remove them
        const indexes = await queryInterface.showIndex('Companies');
        const existingIndexNames = indexes.map(index => index.name);
        
        // Remove indexes if they exist (wrap in try-catch for FK constraint issues)
        if (existingIndexNames.includes('idx_companies_type_status')) {
          try {
            console.log("Removing index 'idx_companies_type_status'...");
            await queryInterface.removeIndex('Companies', 'idx_companies_type_status', { transaction });
          } catch (error) {
            console.warn('Could not remove index idx_companies_type_status:', error.message);
          }
        }
        
        if (existingIndexNames.includes('idx_companies_primary_contact_user_id')) {
          try {
            console.log("Removing index 'idx_companies_primary_contact_user_id'...");
            await queryInterface.removeIndex('Companies', 'idx_companies_primary_contact_user_id', { transaction });
          } catch (error) {
            console.warn('Could not remove index idx_companies_primary_contact_user_id:', error.message);
          }
        }
        
        if (existingIndexNames.includes('idx_companies_billing_plan_id')) {
          try {
            console.log("Removing index 'idx_companies_billing_plan_id'...");
            await queryInterface.removeIndex('Companies', 'idx_companies_billing_plan_id', { transaction });
          } catch (error) {
            console.warn('Could not remove index idx_companies_billing_plan_id:', error.message);
          }
        }
        
        if (existingIndexNames.includes('unique_company_name')) {
          try {
            console.log("Removing index 'unique_company_name'...");
            await queryInterface.removeIndex('Companies', 'unique_company_name', { transaction });
          } catch (error) {
            console.warn('Could not remove index unique_company_name:', error.message);
          }
        }
        
        // Note: Check constraints on type and status columns are created by migration 
        // 20250627000003-add-company-data-integrity-constraints and will be removed 
        // by that migration's down method when it runs before this one
        
        // Get current table structure before removing columns
        const tableDescription = await queryInterface.describeTable('Companies');
        
        // Remove columns if they exist (billing_plan_id has no FK constraint to remove)
        if (tableDescription.submitted_documents_ref) {
          console.log("Removing 'submitted_documents_ref' column...");
          await queryInterface.removeColumn('Companies', 'submitted_documents_ref', { transaction });
        }
        
        if (tableDescription.primary_contact_user_id) {
          console.log("Removing 'primary_contact_user_id' column...");
          await queryInterface.removeColumn('Companies', 'primary_contact_user_id', { transaction });
        }
        
        if (tableDescription.billing_plan_id) {
          console.log("Removing 'billing_plan_id' column...");
          await queryInterface.removeColumn('Companies', 'billing_plan_id', { transaction });
        }
        
        if (tableDescription.status) {
          console.log("Removing 'status' column...");
          await queryInterface.removeColumn('Companies', 'status', { transaction });
        }
        
        if (tableDescription.type) {
          console.log("Removing 'type' column...");
          await queryInterface.removeColumn('Companies', 'type', { transaction });
        }
        
        // Note: subdomain column is preserved as it may have been added by another migration
        
      } catch (error) {
        console.error('Error in Companies table migration rollback:', error);
        throw error;
      }
    });
  }
};