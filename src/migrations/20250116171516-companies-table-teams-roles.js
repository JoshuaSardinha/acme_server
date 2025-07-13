'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create Companies table
    await queryInterface.createTable('Companies', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      phone_number: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      owner_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Users', // This references the Users table
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    // Update Users table
    await queryInterface.addColumn('Users', 'role', {
      type: Sequelize.ENUM(
        'client',
        'vendor_employee',
        'vendor_admin',
        'national_niner_employee',
        'national_niner_admin'
      ),
      allowNull: false,
      defaultValue: 'client',
    });

    await queryInterface.addColumn('Users', 'is_lawyer', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    await queryInterface.addColumn('Users', 'company_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Companies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Create Teams table
    await queryInterface.createTable('Teams', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      manager_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
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

    // Create TeamMembers table
    await queryInterface.createTable(
      'TeamMembers',
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        team_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Teams',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
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
      },
      {
        uniqueKeys: {
          unique_team_user: {
            fields: ['team_id', 'user_id'],
          },
        },
      }
    );

    // Insert National Niner Company
    await queryInterface.bulkInsert('Companies', [
      {
        id: '82ed6abb-a2cd-4384-b62f-1c90a685831f',
        name: 'National Niner',
        address: '123 National Ave, Capital City',
        email: 'contact@nationalniner.com',
        phone_number: '123-456-7890',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('TeamMembers', { cascade: true });
    await queryInterface.dropTable('Teams', { cascade: true });
    await queryInterface.removeColumn('Users', 'company_id');
    await queryInterface.removeColumn('Users', 'is_lawyer');
    await queryInterface.removeColumn('Users', 'role');
    await queryInterface.dropTable('Companies', { cascade: true });
  },
};
