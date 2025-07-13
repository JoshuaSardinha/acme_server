'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Users', 'role', {
      type: Sequelize.ENUM(
        'client',
        'vendor_employee',
        'vendor_admin',
        'national_niner_employee',
        'national_niner_admin',
        'vendor_manager',
        'national_niner_manager'
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
        'national_niner_employee',
        'national_niner_admin'
      ),
      allowNull: false,
    });
  },
};
