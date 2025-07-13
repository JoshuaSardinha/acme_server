'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Starting Company Relationship Optimizations Migration...');
      
      // Add compound index for owner + status queries (common in admin views)
      console.log('Creating owner status compound index...');
      try {
        await queryInterface.addIndex('Companies', ['owner_id', 'status'], {
          name: 'idx_companies_owner_status',
          where: {
            owner_id: {
              [Sequelize.Op.ne]: null
            }
          }
        });
      } catch (error) {
        console.warn('Owner status index may already exist:', error.message);
      }

      // Add primary contact optimization for quick lookups
      console.log('Creating primary contact optimization index...');
      try {
        await queryInterface.addIndex('Companies', ['primary_contact_user_id'], {
          name: 'idx_companies_primary_contact',
          where: {
            primary_contact_user_id: {
              [Sequelize.Op.ne]: null
            }
          }
        });
      } catch (error) {
        console.warn('Primary contact index may already exist:', error.message);
      }

      // Add subscription billing optimization
      console.log('Creating subscription billing index...');
      try {
        await queryInterface.addIndex('Companies', ['subscription_type', 'subscription_status', 'status'], {
          name: 'idx_companies_subscription_billing',
          where: {
            type: 'VENDOR'
          }
        });
      } catch (error) {
        console.warn('Subscription billing index may already exist:', error.message);
      }

      // Add tenant routing super-fast index (subdomain + status)
      console.log('Creating tenant routing optimization index...');
      try {
        await queryInterface.addIndex('Companies', ['subdomain'], {
          name: 'idx_companies_tenant_routing_fast',
          unique: true,
          where: {
            subdomain: {
              [Sequelize.Op.ne]: null
            }
          }
        });
      } catch (error) {
        console.warn('Tenant routing index may already exist:', error.message);
      }

      // Add vendor workflow optimization (type + status + created_at)
      console.log('Creating vendor workflow optimization index...');
      try {
        await queryInterface.addIndex('Companies', ['type', 'status', 'created_at'], {
          name: 'idx_companies_vendor_workflow'
        });
      } catch (error) {
        console.warn('Vendor workflow index may already exist:', error.message);
      }

      // Add active companies fast access (most common query)
      console.log('Creating active companies fast access index...');
      try {
        await queryInterface.addIndex('Companies', ['status', 'type', 'subdomain'], {
          name: 'idx_companies_active_fast',
          where: {
            status: 'ACTIVE'
          }
        });
      } catch (error) {
        console.warn('Active companies index may already exist:', error.message);
      }

      // Add foreign key performance optimization for Users table lookups
      console.log('Creating foreign key optimization indexes...');
      try {
        await queryInterface.addIndex('Companies', ['owner_id', 'type'], {
          name: 'idx_companies_fk_owner_optimization'
        });
      } catch (error) {
        console.warn('Owner FK optimization index may already exist:', error.message);
      }

      try {
        await queryInterface.addIndex('Companies', ['primary_contact_user_id', 'status'], {
          name: 'idx_companies_fk_contact_optimization'
        });
      } catch (error) {
        console.warn('Contact FK optimization index may already exist:', error.message);
      }

      console.log('Company Relationship Optimizations Migration completed successfully!');
    } catch (error) {
      console.error('Error in Company Relationship Optimizations Migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Rolling back Company Relationship Optimizations Migration...');
      
      const indexesToDrop = [
        'idx_companies_owner_status',
        'idx_companies_primary_contact',
        'idx_companies_subscription_billing',
        'idx_companies_tenant_routing_fast',
        'idx_companies_vendor_workflow',
        'idx_companies_active_fast',
        'idx_companies_fk_owner_optimization',
        'idx_companies_fk_contact_optimization'
      ];

      for (const indexName of indexesToDrop) {
        try {
          await queryInterface.removeIndex('Companies', indexName);
          console.log(`Dropped relationship index: ${indexName}`);
        } catch (error) {
          console.warn(`Relationship index ${indexName} may not exist:`, error.message);
        }
      }

      console.log('Company Relationship Optimizations Migration rollback completed!');
    } catch (error) {
      console.error('Error rolling back Company Relationship Optimizations Migration:', error);
      throw error;
    }
  }
};