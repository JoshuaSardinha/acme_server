'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Permission extends Model {
    static associate(models) {
      Permission.belongsToMany(models.Role, {
        through: models.RolePermission,
        foreignKey: 'permission_id',
        otherKey: 'role_id',
        as: 'roles',
      });
      
      Permission.belongsToMany(models.User, {
        through: models.UserPermission,
        foreignKey: 'permission_id',
        otherKey: 'user_id',
        as: 'users',
      });
      
      Permission.hasMany(models.RolePermission, { 
        foreignKey: 'permission_id', 
        as: 'role_permissions' 
      });
      
      Permission.hasMany(models.UserPermission, { 
        foreignKey: 'permission_id', 
        as: 'user_permissions' 
      });
    }
  }

  Permission.init(
    {
      id: {
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: true,
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
      modelName: 'Permission',
      tableName: 'Permissions',
      timestamps: true,
      underscored: true,
    }
  );

  return Permission;
};