'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TeamMember extends Model {
    static associate(models) {}
  }
  TeamMember.init(
    {
      id: {
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true,
      },
      team_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Teams',
          key: 'id',
        },
      },
      user_id: {
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
      modelName: 'TeamMember',
      tableName: 'TeamMembers',
      timestamps: true,
      underscored: true,
    }
  );
  return TeamMember;
};
