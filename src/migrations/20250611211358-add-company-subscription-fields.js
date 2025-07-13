'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add subscription_type column to Companies table
    await queryInterface.addColumn('Companies', 'subscription_type', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add subscription_status column to Companies table
    await queryInterface.addColumn('Companies', 'subscription_status', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove subscription columns from Companies table
    await queryInterface.removeColumn('Companies', 'subscription_status');
    await queryInterface.removeColumn('Companies', 'subscription_type');
  }
};
