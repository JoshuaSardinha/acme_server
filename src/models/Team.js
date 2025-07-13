'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Team extends Model {
    static associate(models) {
      // Associations
      Team.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE',
      });
      Team.belongsTo(models.User, { foreignKey: 'owner_user_id', as: 'owner', onDelete: 'CASCADE' });
      Team.belongsToMany(models.User, {
        through: models.TeamMember,
        foreignKey: 'team_id',
        otherKey: 'user_id',
        as: 'members',
      });
    }
  }
  Team.init(
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
      company_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Companies',
          key: 'id',
        },
      },
      owner_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
    },
    {
      sequelize,
      modelName: 'Team',
      tableName: 'Teams',
      timestamps: true,
      underscored: true,
    }
  );
  return Team;
};
