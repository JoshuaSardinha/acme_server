'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Add status column to Users table
      await queryInterface.addColumn('Users', 'status', {
        type: Sequelize.ENUM('pending', 'active', 'suspended', 'deactivated'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'User account status lifecycle'
      }, { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Remove status column from Users table
      await queryInterface.removeColumn('Users', 'status', { transaction });
    });
  }
};
