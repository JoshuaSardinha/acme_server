const db = require('../models');

const roleService = {
  updateUserRole: async (userId, role) => {
    try {
      await db.User.update({ role }, { where: { id: userId } });
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },
};

module.exports = roleService;
