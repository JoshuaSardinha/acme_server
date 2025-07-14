'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Users', 'role', {
      type: Sequelize.ENUM(
        'client',
        'vendor_employee',
        'vendor_admin',
        'acme_employee',
        'acme_admin',
        'vendor_manager',
        'acme_manager'
      ),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Users', 'role', {
      type: Sequelize.ENUM(
        'client',
        'vendor_employee',
        'vendor_admin',
        'acme_employee',
        'acme_admin'
      ),
      allowNull: false,
    });
  },
};
