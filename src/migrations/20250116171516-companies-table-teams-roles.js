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
        'acme_employee',
        'acme_admin'
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

    // Insert Acme Company
    await queryInterface.bulkInsert('Companies', [
      {
        id: '82ed6abb-a2cd-4384-b62f-1c90a685831f',
        name: 'Acme',
        address: '123 Acme Ave, Capital City',
        email: 'contact@acme.com',
        phone_number: '123-456-7890',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Get list of existing tables
      const tables = await queryInterface.showAllTables();
      
      // Drop tables if they exist (in reverse order due to foreign key dependencies)
      if (tables.includes('TeamMembers')) {
        console.log("Dropping 'TeamMembers' table...");
        await queryInterface.dropTable('TeamMembers', { cascade: true, transaction });
      } else {
        console.log("'TeamMembers' table does not exist, skipping drop.");
      }
      
      if (tables.includes('Teams')) {
        console.log("Dropping 'Teams' table...");
        await queryInterface.dropTable('Teams', { cascade: true, transaction });
      } else {
        console.log("'Teams' table does not exist, skipping drop.");
      }
      
      // Get current Users table structure before removing columns
      const userTableDescription = await queryInterface.describeTable('Users');
      
      // Remove columns from Users table if they exist
      if (userTableDescription.company_id) {
        console.log("Removing 'company_id' column from Users table...");
        await queryInterface.removeColumn('Users', 'company_id', { transaction });
      } else {
        console.log("'company_id' column does not exist in Users table, skipping removal.");
      }
      
      if (userTableDescription.is_lawyer) {
        console.log("Removing 'is_lawyer' column from Users table...");
        await queryInterface.removeColumn('Users', 'is_lawyer', { transaction });
      } else {
        console.log("'is_lawyer' column does not exist in Users table, skipping removal.");
      }
      
      if (userTableDescription.role) {
        console.log("Removing 'role' column from Users table...");
        await queryInterface.removeColumn('Users', 'role', { transaction });
      } else {
        console.log("'role' column does not exist in Users table, skipping removal.");
      }
      
      // Drop Companies table if it exists
      if (tables.includes('Companies')) {
        console.log("Dropping 'Companies' table...");
        await queryInterface.dropTable('Companies', { cascade: true, transaction });
      } else {
        console.log("'Companies' table does not exist, skipping drop.");
      }
    });
  },
};
