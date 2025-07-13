'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create Roles table
    await queryInterface.createTable('Roles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      company_id: {
        type: Sequelize.UUID,
        allowNull: true, // NULL for system-wide roles
        references: {
          model: 'Companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      is_system_role: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'True for built-in system roles that cannot be deleted',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Add index for company-based role lookups
    await queryInterface.addIndex('Roles', ['company_id']);
    await queryInterface.addIndex('Roles', ['name', 'company_id'], {
      unique: true,
      name: 'unique_role_name_per_company',
    });

    // Create Permissions table
    await queryInterface.createTable('Permissions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Permission identifier (e.g., "user.create", "company.manage")',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Human-readable description of what this permission allows',
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Category for grouping permissions (e.g., "user", "company", "team")',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Add index for permission lookups
    await queryInterface.addIndex('Permissions', ['category']);
    await queryInterface.addIndex('Permissions', ['name']);

    // Create RolePermissions junction table
    await queryInterface.createTable('RolePermissions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Roles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      permission_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Permissions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Add unique constraint and indexes
    await queryInterface.addIndex('RolePermissions', ['role_id', 'permission_id'], {
      unique: true,
      name: 'unique_role_permission',
    });
    await queryInterface.addIndex('RolePermissions', ['role_id']);
    await queryInterface.addIndex('RolePermissions', ['permission_id']);

    // Create UserRoles junction table
    await queryInterface.createTable('UserRoles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Roles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      granted_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User who granted this role',
      },
      granted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Add unique constraint and indexes
    await queryInterface.addIndex('UserRoles', ['user_id', 'role_id'], {
      unique: true,
      name: 'unique_user_role',
    });
    await queryInterface.addIndex('UserRoles', ['user_id']);
    await queryInterface.addIndex('UserRoles', ['role_id']);
    await queryInterface.addIndex('UserRoles', ['granted_by']);

    // Create UserPermissions table for direct user permissions
    await queryInterface.createTable('UserPermissions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      permission_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Permissions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      granted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'True to grant permission, false to explicitly deny',
      },
      granted_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User who granted/denied this permission',
      },
      granted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Add unique constraint and indexes
    await queryInterface.addIndex('UserPermissions', ['user_id', 'permission_id'], {
      unique: true,
      name: 'unique_user_permission',
    });
    await queryInterface.addIndex('UserPermissions', ['user_id']);
    await queryInterface.addIndex('UserPermissions', ['permission_id']);
    await queryInterface.addIndex('UserPermissions', ['granted_by']);

    // Insert default permissions
    const permissions = [
      // User management permissions
      { id: '00000000-0000-0000-0000-000000000001', name: 'user.create', description: 'Create new users', category: 'user' },
      { id: '00000000-0000-0000-0000-000000000002', name: 'user.read', description: 'View user information', category: 'user' },
      { id: '00000000-0000-0000-0000-000000000003', name: 'user.update', description: 'Update user information', category: 'user' },
      { id: '00000000-0000-0000-0000-000000000004', name: 'user.delete', description: 'Delete users', category: 'user' },
      { id: '00000000-0000-0000-0000-000000000005', name: 'user.manage_roles', description: 'Assign/remove roles from users', category: 'user' },
      
      // Company management permissions
      { id: '00000000-0000-0000-0000-000000000010', name: 'company.create', description: 'Create new companies', category: 'company' },
      { id: '00000000-0000-0000-0000-000000000011', name: 'company.read', description: 'View company information', category: 'company' },
      { id: '00000000-0000-0000-0000-000000000012', name: 'company.update', description: 'Update company information', category: 'company' },
      { id: '00000000-0000-0000-0000-000000000013', name: 'company.delete', description: 'Delete companies', category: 'company' },
      { id: '00000000-0000-0000-0000-000000000014', name: 'company.manage_users', description: 'Add/remove users from company', category: 'company' },
      
      // Team management permissions
      { id: '00000000-0000-0000-0000-000000000020', name: 'team.create', description: 'Create new teams', category: 'team' },
      { id: '00000000-0000-0000-0000-000000000021', name: 'team.read', description: 'View team information', category: 'team' },
      { id: '00000000-0000-0000-0000-000000000022', name: 'team.update', description: 'Update team information', category: 'team' },
      { id: '00000000-0000-0000-0000-000000000023', name: 'team.delete', description: 'Delete teams', category: 'team' },
      { id: '00000000-0000-0000-0000-000000000024', name: 'team.manage_members', description: 'Add/remove team members', category: 'team' },
      
      // Role management permissions
      { id: '00000000-0000-0000-0000-000000000030', name: 'role.create', description: 'Create new roles', category: 'role' },
      { id: '00000000-0000-0000-0000-000000000031', name: 'role.read', description: 'View role information', category: 'role' },
      { id: '00000000-0000-0000-0000-000000000032', name: 'role.update', description: 'Update role information', category: 'role' },
      { id: '00000000-0000-0000-0000-000000000033', name: 'role.delete', description: 'Delete roles', category: 'role' },
      { id: '00000000-0000-0000-0000-000000000034', name: 'role.manage_permissions', description: 'Assign/remove permissions from roles', category: 'role' },
      
      // System administration permissions
      { id: '00000000-0000-0000-0000-000000000040', name: 'system.admin', description: 'Full system administration access', category: 'system' },
      { id: '00000000-0000-0000-0000-000000000041', name: 'system.config', description: 'Manage system configuration', category: 'system' },
      { id: '00000000-0000-0000-0000-000000000042', name: 'system.logs', description: 'View system logs', category: 'system' },
    ];

    await queryInterface.bulkInsert('Permissions', permissions.map(p => ({
      ...p,
      created_at: new Date(),
      updated_at: new Date(),
    })));

    // Insert default roles
    const roles = [
      { id: '00000000-0000-0000-0000-000000001001', name: 'System Administrator', description: 'Full system access', company_id: null, is_system_role: true },
      { id: '00000000-0000-0000-0000-000000001002', name: 'Company Admin', description: 'Company administration access', company_id: null, is_system_role: true },
      { id: '00000000-0000-0000-0000-000000001003', name: 'Team Manager', description: 'Team management access', company_id: null, is_system_role: true },
      { id: '00000000-0000-0000-0000-000000001004', name: 'Employee', description: 'Basic employee access', company_id: null, is_system_role: true },
      { id: '00000000-0000-0000-0000-000000001005', name: 'Client', description: 'Client access', company_id: null, is_system_role: true },
    ];

    await queryInterface.bulkInsert('Roles', roles.map(r => ({
      ...r,
      created_at: new Date(),
      updated_at: new Date(),
    })));

    // Assign permissions to System Administrator role
    const systemAdminPermissions = permissions.map(p => ({
      id: require('crypto').randomUUID(),
      role_id: '00000000-0000-0000-0000-000000001001',
      permission_id: p.id,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await queryInterface.bulkInsert('RolePermissions', systemAdminPermissions);

    // Assign basic permissions to other roles
    const rolePermissionMappings = [
      // Company Admin permissions
      { role_id: '00000000-0000-0000-0000-000000001002', permissions: ['user.read', 'user.update', 'user.manage_roles', 'company.read', 'company.update', 'company.manage_users', 'team.create', 'team.read', 'team.update', 'team.delete', 'team.manage_members', 'role.read'] },
      
      // Team Manager permissions
      { role_id: '00000000-0000-0000-0000-000000001003', permissions: ['user.read', 'team.read', 'team.update', 'team.manage_members'] },
      
      // Employee permissions
      { role_id: '00000000-0000-0000-0000-000000001004', permissions: ['user.read', 'team.read'] },
      
      // Client permissions
      { role_id: '00000000-0000-0000-0000-000000001005', permissions: ['user.read'] },
    ];

    for (const mapping of rolePermissionMappings) {
      const rolePermissions = mapping.permissions.map(permName => {
        const permission = permissions.find(p => p.name === permName);
        return {
          id: require('crypto').randomUUID(),
          role_id: mapping.role_id,
          permission_id: permission.id,
          created_at: new Date(),
          updated_at: new Date(),
        };
      });
      
      await queryInterface.bulkInsert('RolePermissions', rolePermissions);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('UserPermissions', { cascade: true });
    await queryInterface.dropTable('UserRoles', { cascade: true });
    await queryInterface.dropTable('RolePermissions', { cascade: true });
    await queryInterface.dropTable('Permissions', { cascade: true });
    await queryInterface.dropTable('Roles', { cascade: true });
  },
};