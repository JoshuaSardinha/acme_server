'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Creating CompanyAuditLog table for audit trail tracking...');
      
      // Create CompanyAuditLog table
      await queryInterface.createTable('CompanyAuditLogs', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          comment: 'Primary key for audit log entry'
        },
        company_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Companies',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'Company being audited'
        },
        action: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: 'Action performed (VENDOR_REGISTERED, VENDOR_APPROVED, VENDOR_REJECTED, etc.)'
        },
        performed_by: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT', // Preserve audit trail even if user is deleted
          comment: 'User who performed the action'
        },
        performed_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
          comment: 'Timestamp when action was performed'
        },
        previous_status: {
          type: Sequelize.ENUM('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED'),
          allowNull: true,
          comment: 'Previous company status (for status change actions)'
        },
        new_status: {
          type: Sequelize.ENUM('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED'),
          allowNull: true,
          comment: 'New company status (for status change actions)'
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Reason provided for the action (especially for rejections/suspensions)'
        },
        details: {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Additional details about the action (registration data, metadata, etc.)'
        },
        ip_address: {
          type: Sequelize.STRING(45), // Support IPv6
          allowNull: true,
          comment: 'IP address of the performing user'
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'User agent string for additional context'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
          comment: 'Record creation timestamp'
        }
      }, {
        comment: 'Audit log for all company-related actions and status changes'
      });
      
      console.log('Adding indexes for CompanyAuditLog performance...');
      
      // Primary index for company audit queries
      await queryInterface.addIndex('CompanyAuditLogs', ['company_id', 'performed_at'], {
        name: 'idx_company_audit_company_date',
        comment: 'Optimizes queries for company audit history'
      });
      
      // Index for user audit queries
      await queryInterface.addIndex('CompanyAuditLogs', ['performed_by', 'performed_at'], {
        name: 'idx_company_audit_user_date',
        comment: 'Optimizes queries for user action history'
      });
      
      // Index for action type queries
      await queryInterface.addIndex('CompanyAuditLogs', ['action', 'performed_at'], {
        name: 'idx_company_audit_action_date',
        comment: 'Optimizes queries by action type'
      });
      
      // Index for status transition queries
      await queryInterface.addIndex('CompanyAuditLogs', ['previous_status', 'new_status', 'performed_at'], {
        name: 'idx_company_audit_status_transitions',
        comment: 'Optimizes queries for status transition analysis'
      });
      
      // Index for date range queries (for reporting)
      await queryInterface.addIndex('CompanyAuditLogs', ['performed_at'], {
        name: 'idx_company_audit_date_range',
        comment: 'Optimizes date range queries for reporting'
      });
      
      console.log('CompanyAuditLog table and indexes created successfully');
      
    } catch (error) {
      console.error('Error creating CompanyAuditLog table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Dropping CompanyAuditLog table...');
      
      // Drop the table (indexes will be dropped automatically)
      await queryInterface.dropTable('CompanyAuditLogs', { cascade: true });
      
      console.log('CompanyAuditLog table dropped successfully');
      
    } catch (error) {
      console.error('Error dropping CompanyAuditLog table:', error);
      throw error;
    }
  }
};