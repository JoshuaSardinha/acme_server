'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Adding performance indexes for Company management features...');
      
      // Get existing indexes to avoid duplicates
      const indexes = await queryInterface.showIndex('Companies');
      const existingIndexNames = indexes.map(index => index.name);
      
      // 1. Compound index for admin search queries (name, email, subdomain)
      if (!existingIndexNames.includes('idx_companies_search_fields')) {
        console.log('Adding search optimization index...');
        await queryInterface.addIndex('Companies', ['name', 'email', 'subdomain'], {
          name: 'idx_companies_search_fields',
          comment: 'Optimizes admin search across name, email, and subdomain fields'
        });
      }
      
      // 2. Compound index for admin filtering (status, type, created_at)
      if (!existingIndexNames.includes('idx_companies_admin_filtering')) {
        console.log('Adding admin filtering index...');
        await queryInterface.addIndex('Companies', ['status', 'type', 'created_at'], {
          name: 'idx_companies_admin_filtering',
          comment: 'Optimizes admin list queries with status/type filtering and date sorting'
        });
      }
      
      // 3. Index for efficient pagination queries
      if (!existingIndexNames.includes('idx_companies_pagination')) {
        console.log('Adding pagination optimization index...');
        await queryInterface.addIndex('Companies', ['created_at', 'id'], {
          name: 'idx_companies_pagination',
          comment: 'Optimizes pagination queries using created_at and id for consistent sorting'
        });
      }
      
      // 4. Standard index for company name searches
      if (!existingIndexNames.includes('idx_companies_name_search')) {
        console.log('Adding name search index...');
        // Use standard index - functional indexes have compatibility issues across MySQL versions
        // Application can handle case-insensitive searches with LOWER() in queries
        await queryInterface.addIndex('Companies', ['name'], {
          name: 'idx_companies_name_search',
          comment: 'Optimizes company name searches (use LOWER() in queries for case-insensitive search)'
        });
      }
      
      // 5. Compound index for vendor-specific queries
      if (!existingIndexNames.includes('idx_companies_vendor_queries')) {
        console.log('Adding vendor-specific query index...');
        await queryInterface.addIndex('Companies', ['type', 'status', 'owner_id'], {
          name: 'idx_companies_vendor_queries',
          where: { type: 'VENDOR' },
          comment: 'Optimizes queries for vendor companies by status and owner'
        });
      }
      
      // 6. Index for subdomain lookups (critical for multi-tenant routing)
      if (!existingIndexNames.includes('idx_companies_subdomain_active')) {
        console.log('Adding active subdomain lookup index...');
        await queryInterface.addIndex('Companies', ['subdomain', 'status'], {
          name: 'idx_companies_subdomain_active',
          where: { status: 'ACTIVE' },
          comment: 'Optimizes subdomain lookups for active companies only'
        });
      }
      
      console.log('Company performance indexes added successfully');
      
    } catch (error) {
      console.error('Error adding company performance indexes:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Removing company performance indexes...');
      
      const indexesToRemove = [
        'idx_companies_subdomain_active',
        'idx_companies_vendor_queries', 
        'idx_companies_name_search',
        'idx_companies_pagination',
        'idx_companies_admin_filtering',
        'idx_companies_search_fields'
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
      console.error('Error removing company performance indexes:', error);
      throw error;
    }
  }
};