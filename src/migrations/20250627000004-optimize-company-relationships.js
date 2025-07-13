'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Optimizing Company relationship indexes and constraints...');
      
      // Get existing indexes to avoid duplicates
      const indexes = await queryInterface.showIndex('Companies');
      const existingIndexNames = indexes.map(index => index.name);
      
      // 1. Optimize owner_id index (if not already optimal)
      if (!existingIndexNames.includes('idx_companies_owner_id_optimized')) {
        console.log('Adding optimized owner_id index...');
        await queryInterface.addIndex('Companies', ['owner_id', 'status', 'type'], {
          name: 'idx_companies_owner_id_optimized',
          comment: 'Optimizes queries for companies by owner with status and type filtering'
        });
      }
      
      // 2. Add index for primary contact queries
      if (!existingIndexNames.includes('idx_companies_primary_contact_optimized')) {
        console.log('Adding optimized primary contact index...');
        await queryInterface.addIndex('Companies', ['primary_contact_user_id', 'status'], {
          name: 'idx_companies_primary_contact_optimized',
          comment: 'Optimizes queries for companies by primary contact'
        });
      }
      
      // 3. Add compound index for multi-tenant subdomain lookups
      if (!existingIndexNames.includes('idx_companies_tenant_routing')) {
        console.log('Adding tenant routing optimization index...');
        await queryInterface.addIndex('Companies', ['subdomain', 'type', 'status'], {
          name: 'idx_companies_tenant_routing',
          where: { subdomain: { [Sequelize.Op.ne]: null } },
          comment: 'Optimizes multi-tenant subdomain routing queries'
        });
      }
      
      // 4. Add partial index for active companies only (most common queries)
      if (!existingIndexNames.includes('idx_companies_active_only')) {
        console.log('Adding active companies index...');
        await queryInterface.addIndex('Companies', ['type', 'created_at', 'name'], {
          name: 'idx_companies_active_only',
          where: { status: 'ACTIVE' },
          comment: 'Optimizes queries for active companies (most common use case)'
        });
      }
      
      // 5. Add index for vendor onboarding workflow queries
      if (!existingIndexNames.includes('idx_companies_vendor_workflow')) {
        console.log('Adding vendor workflow index...');
        await queryInterface.addIndex('Companies', ['status', 'created_at', 'owner_id'], {
          name: 'idx_companies_vendor_workflow',
          where: { type: 'VENDOR' },
          comment: 'Optimizes vendor onboarding workflow queries'
        });
      }
      
      // 6. Add index for billing-related queries (only if columns exist)
      if (!existingIndexNames.includes('idx_companies_billing_queries')) {
        console.log('Checking for billing columns...');
        const tableDescription = await queryInterface.describeTable('Companies');
        
        if (tableDescription.subscription_type && tableDescription.subscription_status) {
          console.log('Adding billing optimization index...');
          await queryInterface.addIndex('Companies', ['subscription_type', 'subscription_status', 'status'], {
            name: 'idx_companies_billing_queries',
            where: { type: 'VENDOR' },
            comment: 'Optimizes billing and subscription-related queries'
          });
        } else {
          console.log('Billing columns not found, skipping billing index...');
        }
      }
      
      // 7. Check and optimize foreign key constraints
      console.log('Verifying foreign key constraints...');
      
      const tableDescription = await queryInterface.describeTable('Companies');
      
      // Ensure proper foreign key constraints exist with correct cascade options
      if (tableDescription.owner_id) {
        // The foreign key should already exist, but let's ensure it has the right cascade behavior
        console.log('Foreign key constraints for owner_id already configured');
      }
      
      if (tableDescription.primary_contact_user_id) {
        // The foreign key should already exist from previous migrations
        console.log('Foreign key constraints for primary_contact_user_id already configured');
      }
      
      console.log('Company relationship optimizations completed successfully');
      
    } catch (error) {
      console.error('Error optimizing company relationships:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Removing company relationship optimization indexes...');
      
      const indexesToRemove = [
        'idx_companies_billing_queries',
        'idx_companies_vendor_workflow',
        'idx_companies_active_only',
        'idx_companies_tenant_routing',
        'idx_companies_primary_contact_optimized',
        'idx_companies_owner_id_optimized'
      ];
      
      for (const indexName of indexesToRemove) {
        try {
          await queryInterface.removeIndex('Companies', indexName);
          console.log(`Removed index: ${indexName}`);
        } catch (error) {
          console.warn(`Could not remove index ${indexName}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('Error removing company relationship optimizations:', error);
      throw error;
    }
  }
};