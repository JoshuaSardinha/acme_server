'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
      User.hasMany(models.Team, { foreignKey: 'owner_user_id', as: 'owned_teams' });
      User.belongsToMany(models.Team, {
        through: models.TeamMember,
        foreignKey: 'user_id',
        as: 'teams',
      });
      
      // Permission system relationships
      User.belongsToMany(models.Role, {
        through: models.UserRole,
        foreignKey: 'user_id',
        otherKey: 'role_id',
        as: 'roles',
      });
      
      User.belongsToMany(models.Permission, {
        through: models.UserPermission,
        foreignKey: 'user_id',
        otherKey: 'permission_id',
        as: 'permissions',
      });
      
      User.hasMany(models.UserRole, { 
        foreignKey: 'user_id', 
        as: 'user_roles' 
      });
      
      User.hasMany(models.UserPermission, { 
        foreignKey: 'user_id', 
        as: 'user_permissions' 
      });
    }
  }
  User.init(
    {
      id: {
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true,
      },
      first_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      auth0_user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      role: {
        type: DataTypes.ENUM(
          'client',
          'vendor_employee',
          'vendor_admin',
          'national_niner_employee',
          'national_niner_admin',
          'vendor_manager',
          'national_niner_manager'
        ),
        allowNull: false,
        defaultValue: 'client',
      },
      is_lawyer: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      company_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Companies',
          key: 'id',
        },
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'Users',
      timestamps: true,
      underscored: true,
    }
  );
  return User;
};
