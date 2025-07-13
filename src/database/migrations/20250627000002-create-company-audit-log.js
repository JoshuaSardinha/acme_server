'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Starting Company Audit Log Migration...');
      
      // Create CompanyAuditLog table
      console.log('Creating CompanyAuditLog table...');
      await queryInterface.createTable('CompanyAuditLogs', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        company_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Companies',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        action: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: 'Action performed (VENDOR_REGISTERED, VENDOR_APPROVED, etc.)'
        },
        performed_by: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        performed_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        previous_status: {
          type: Sequelize.ENUM('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED'),
          allowNull: true,
          comment: 'Previous company status before the action'
        },
        new_status: {
          type: Sequelize.ENUM('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED'),
          allowNull: true,
          comment: 'New company status after the action'
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Reason for the action (required for rejections/suspensions)'
        },
        details: {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Additional structured data related to the action'
        },
        ip_address: {
          type: Sequelize.STRING(45),
          allowNull: true,
          comment: 'IP address of the performer for security tracking'
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'User agent for security and analytics'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      });

      // Add performance indexes for audit log queries
      console.log('Creating audit log performance indexes...');
      
      // Company history index
      await queryInterface.addIndex('CompanyAuditLogs', ['company_id', 'performed_at'], {
        name: 'idx_audit_company_history'
      });

      // User actions index
      await queryInterface.addIndex('CompanyAuditLogs', ['performed_by', 'performed_at'], {
        name: 'idx_audit_user_actions'
      });

      // Action type index for filtering
      await queryInterface.addIndex('CompanyAuditLogs', ['action', 'performed_at'], {
        name: 'idx_audit_action_type'
      });

      // Status transition index for reporting
      await queryInterface.addIndex('CompanyAuditLogs', ['previous_status', 'new_status', 'performed_at'], {
        name: 'idx_audit_status_transitions'
      });

      // Date range index for time-based queries
      await queryInterface.addIndex('CompanyAuditLogs', ['performed_at'], {
        name: 'idx_audit_date_range'
      });

      console.log('Company Audit Log Migration completed successfully!');
    } catch (error) {
      console.error('Error in Company Audit Log Migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Rolling back Company Audit Log Migration...');
      
      // Drop indexes first
      const indexesToDrop = [
        'idx_audit_company_history',
        'idx_audit_user_actions', 
        'idx_audit_action_type',
        'idx_audit_status_transitions',
        'idx_audit_date_range'
      ];

      for (const indexName of indexesToDrop) {
        try {
          await queryInterface.removeIndex('CompanyAuditLogs', indexName);
          console.log(`Dropped audit index: ${indexName}`);
        } catch (error) {
          console.warn(`Audit index ${indexName} may not exist:`, error.message);
        }
      }

      // Drop the table
      await queryInterface.dropTable('CompanyAuditLogs');
      console.log('Dropped CompanyAuditLogs table');

      console.log('Company Audit Log Migration rollback completed!');
    } catch (error) {
      console.error('Error rolling back Company Audit Log Migration:', error);
      throw error;
    }
  }
};