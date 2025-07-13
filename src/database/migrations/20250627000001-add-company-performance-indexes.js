'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Starting Company Performance Indexes Migration...');
      
      // Add compound index for admin listing queries (status + type + created_at)
      console.log('Creating compound index for admin listing...');
      try {
        await queryInterface.addIndex('Companies', ['status', 'type', 'created_at'], {
          name: 'idx_companies_admin_listing',
          where: {
            type: 'VENDOR'
          }
        });
      } catch (error) {
        console.warn('Admin listing index may already exist:', error.message);
      }

      // Add compound index for search queries (name + email + subdomain)
      console.log('Creating search optimization index...');
      try {
        await queryInterface.sequelize.query(`
          CREATE INDEX idx_companies_search_optimized 
          ON Companies (LOWER(name), LOWER(email), LOWER(subdomain))
        `);
      } catch (error) {
        console.warn('Search index may already exist:', error.message);
      }

      // Add pagination optimization index (created_at + id for consistent ordering)
      console.log('Creating pagination optimization index...');
      try {
        await queryInterface.addIndex('Companies', ['created_at', 'id'], {
          name: 'idx_companies_pagination'
        });
      } catch (error) {
        console.warn('Pagination index may already exist:', error.message);
      }

      // Add subdomain routing index for tenant access
      console.log('Creating subdomain routing index...');
      try {
        await queryInterface.addIndex('Companies', ['subdomain', 'status'], {
          name: 'idx_companies_subdomain_routing',
          where: {
            status: 'ACTIVE'
          }
        });
      } catch (error) {
        console.warn('Subdomain routing index may already exist:', error.message);
      }

      // Add status transition workflow index
      console.log('Creating status workflow index...');
      try {
        await queryInterface.addIndex('Companies', ['status', 'updated_at'], {
          name: 'idx_companies_status_workflow'
        });
      } catch (error) {
        console.warn('Status workflow index may already exist:', error.message);
      }

      // Add owner relationship optimization
      console.log('Creating owner relationship index...');
      try {
        await queryInterface.addIndex('Companies', ['owner_id', 'status', 'type'], {
          name: 'idx_companies_owner_relationship'
        });
      } catch (error) {
        console.warn('Owner relationship index may already exist:', error.message);
      }

      console.log('Company Performance Indexes Migration completed successfully!');
    } catch (error) {
      console.error('Error in Company Performance Indexes Migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Rolling back Company Performance Indexes Migration...');
      
      const indexesToDrop = [
        'idx_companies_admin_listing',
        'idx_companies_search_optimized',
        'idx_companies_pagination',
        'idx_companies_subdomain_routing',
        'idx_companies_status_workflow',
        'idx_companies_owner_relationship'
      ];

      for (const indexName of indexesToDrop) {
        try {
          await queryInterface.removeIndex('Companies', indexName);
          console.log(`Dropped index: ${indexName}`);
        } catch (error) {
          console.warn(`Index ${indexName} may not exist:`, error.message);
        }
      }

      console.log('Company Performance Indexes Migration rollback completed!');
    } catch (error) {
      console.error('Error rolling back Company Performance Indexes Migration:', error);
      throw error;
    }
  }
};