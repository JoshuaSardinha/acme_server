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
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Get current table structure before removing columns
      const tableDescription = await queryInterface.describeTable('Companies');
      
      // Remove subscription columns from Companies table if they exist
      if (tableDescription.subscription_status) {
        console.log("Removing 'subscription_status' column from Companies table...");
        await queryInterface.removeColumn('Companies', 'subscription_status', { transaction });
      } else {
        console.log("'subscription_status' column does not exist in Companies table, skipping removal.");
      }
      
      if (tableDescription.subscription_type) {
        console.log("Removing 'subscription_type' column from Companies table...");
        await queryInterface.removeColumn('Companies', 'subscription_type', { transaction });
      } else {
        console.log("'subscription_type' column does not exist in Companies table, skipping removal.");
      }
    });
  }
};
