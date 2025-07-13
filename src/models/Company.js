'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Company extends Model {
    static associate(models) {
      // Associations
      Company.hasMany(models.User, { foreignKey: 'company_id', as: 'users' });
      Company.hasMany(models.Team, { foreignKey: 'company_id', as: 'teams' });
      Company.belongsTo(models.User, {
        foreignKey: 'owner_id',
        as: 'owner',
      });
    }
  }
  Company.init(
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
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      owner_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
    },
    {
      sequelize,
      modelName: 'Company',
      tableName: 'Companies',
      timestamps: true,
      underscored: true,
    }
  );
  return Company;
};
