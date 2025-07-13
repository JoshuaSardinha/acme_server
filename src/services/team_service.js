'use strict';

const db = require('../models');
const Team = db.Team;
const TeamMember = db.TeamMember;
const { Op } = require('sequelize');

const teamService = {
  getTeamById: async (teamId) => {
    try {
      const team = await Team.findOne({ where: { id: teamId } });

      return team;
    } catch (error) {
      console.error('Error finding team:', error);
      throw error;
    }
  },

  createTeam: async (teamData) => {
    try {
      const team = await Team.create({
        name: teamData.name,
        company_id: teamData.companyId,
        owner_user_id: teamData.managerId,
      });

      for (const userId of teamData.users) {
        await TeamMember.create({
          team_id: team.id,
          user_id: userId,
        });
      }

      return team;
    } catch (error) {
      console.error('Error creating team:', error);
      throw error;
    }
  },

  getTeamsData: async (userId) => {
    try {
      const teams = await Team.findAll({
        attributes: ['id', 'name', 'company_id', 'owner_user_id'],
        include: [
          {
            model: db.User,
            as: 'members',
            attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
            through: { attributes: [] },
          },
          {
            model: db.User,
            as: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
          },
          {
            model: db.Company,
            as: 'company',
            attributes: ['id', 'name', 'address', 'email', 'phone_number'],
            include: [
              {
                model: db.User,
                as: 'owner',
                attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
              },
            ],
          },
        ],
      });

      const formattedTeams = teams.map((team) => ({
        id: team.id,
        name: team.name,
        manager: {
          id: team.manager.id,
          firstName: team.manager.first_name,
          lastName: team.manager.last_name,
          email: team.manager.email,
          role: team.manager.role,
        },
        company: {
          id: team.company.id,
          name: team.company.name,
          address: team.company.address,
          email: team.company.email,
          phoneNumber: team.company.phone_number,
          owner: {
            id: team.company.owner.id,
            firstName: team.company.owner.first_name,
            lastName: team.company.owner.last_name,
            email: team.company.owner.email,
            role: team.company.owner.role,
          },
        },
        members: team.members.map((member) => ({
          id: member.id,
          firstName: member.first_name,
          lastName: member.last_name,
          email: member.email,
          role: member.role,
        })),
      }));

      return formattedTeams;
    } catch (error) {
      console.error('Error getting team data:', error);
      throw error;
    }
  },

  getTeamByUserIdAndTeamId: async (userId, teamId) => {
    try {
      const team = await Team.findOne({
        where: { id: teamId },
        attributes: ['id', 'name', 'company_id', 'owner_user_id'],
        include: [
          {
            model: db.User,
            as: 'members',
            through: {
              where: { user_id: userId },
              attributes: [],
            },
            attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
            required: true,
          },
          {
            model: db.User,
            as: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
          },
          {
            model: db.Company,
            as: 'company',
            attributes: ['id', 'name', 'address', 'email', 'phone_number'],
            include: [
              {
                model: db.User,
                as: 'owner',
                attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
              },
            ],
          },
        ],
      });

      if (!team) return null;

      return {
        id: team.id,
        name: team.name,
        manager: {
          id: team.manager.id,
          firstName: team.manager.first_name,
          lastName: team.manager.last_name,
          email: team.manager.email,
          role: team.manager.role,
        },
        company: {
          id: team.company.id,
          name: team.company.name,
          address: team.company.address,
          email: team.company.email,
          phoneNumber: team.company.phone_number,
          owner: {
            id: team.company.owner.id,
            firstName: team.company.owner.first_name,
            lastName: team.company.owner.last_name,
            email: team.company.owner.email,
            role: team.company.owner.role,
          },
        },
        members: team.members.map((member) => ({
          id: member.id,
          firstName: member.first_name,
          lastName: member.last_name,
          email: member.email,
          role: member.role,
        })),
      };
    } catch (error) {
      console.error('Error getting team data:', error);
      throw error;
    }
  },

  getTeamUsers: async (teamId) => {
    try {
      const users = await db.User.findAll({
        attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'is_lawyer', 'company_id'],
        include: [
          {
            model: db.Team,
            as: 'teams',
            through: {
              where: { team_id: teamId },
              attributes: [],
            },
            attributes: [],
          },
        ],
      });

      const formattedUsers = users.map((user) => ({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        isLawyer: user.is_lawyer,
        companyId: user.company_id,
      }));

      return {
        users: formattedUsers,
      };
    } catch (error) {
      console.error('Error getting users from company:', error);
      throw error;
    }
  },

  createTeamMembers: async (userIds, teamId) => {
    try {
      const teamMembers = await Promise.all(
        userIds.map((userId) =>
          TeamMember.create({
            team_id: teamId,
            user_id: userId,
          })
        )
      );
      return teamMembers;
    } catch (error) {
      console.error('Error adding users to team:', error);
      throw error;
    }
  },

  removeUsersFromTeam: async (teamId, userIds) => {
    try {
      await db.TeamMember.destroy({
        where: {
          team_id: teamId,
          user_id: { [Op.in]: userIds },
        },
      });
    } catch (error) {
      console.error('Error removing users from team:', error);
      throw error;
    }
  },

  deleteTeam: async (teamId) => {
    try {
      await Team.destroy({
        where: { id: teamId },
      });
    } catch (error) {
      console.error('Error deleting team:', error);
      throw error;
    }
  },

  searchUsersForTeam: async (teamId, searchValue, companyId) => {
    try {
      // Get current team members
      const currentTeamMembers = await TeamMember.findAll({
        where: { team_id: teamId },
        attributes: ['user_id'],
      });

      const currentMemberIds = currentTeamMembers.map((member) => member.user_id);

      // Search for users that match criteria and are not in the team
      const users = await db.User.findAll({
        where: {
          company_id: companyId,
          id: {
            [Op.notIn]: currentMemberIds,
          },
          [Op.or]: [
            db.Sequelize.where(
              db.Sequelize.fn('LOWER', db.Sequelize.col('first_name')),
              'LIKE',
              `%${searchValue.toLowerCase()}%`
            ),
            db.Sequelize.where(
              db.Sequelize.fn('LOWER', db.Sequelize.col('last_name')),
              'LIKE',
              `%${searchValue.toLowerCase()}%`
            ),
            db.Sequelize.where(
              db.Sequelize.fn('LOWER', db.Sequelize.col('email')),
              'LIKE',
              `%${searchValue.toLowerCase()}%`
            ),
          ],
        },
        attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'is_lawyer', 'company_id'],
        limit: 10, // Limit results to prevent performance issues
      });

      return {
        users: users.map((user) => ({
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: user.role,
          isLawyer: user.is_lawyer,
          companyId: user.company_id,
        })),
      };
    } catch (error) {
      console.error('Error searching users for team:', error);
      throw error;
    }
  },

  changeTeamManager: async (teamId, newManagerId) => {
    try {
      const [updatedRows] = await Team.update(
        { owner_user_id: newManagerId },
        { where: { id: teamId } }
      );

      if (updatedRows === 0) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error changing team manager:', error);
      throw error;
    }
  },

  replaceTeamUsers: async (teamId, userIds) => {
    try {
      // Start a transaction to ensure data consistency
      await db.sequelize.transaction(async (t) => {
        // Remove all existing team members
        await db.TeamMember.destroy(
          {
            where: { team_id: teamId },
          },
          { transaction: t }
        );

        // Add new team members
        await Promise.all(
          userIds.map((userId) =>
            db.TeamMember.create(
              {
                team_id: teamId,
                user_id: userId,
              },
              { transaction: t }
            )
          )
        );
      });
    } catch (error) {
      console.error('Error replacing team users:', error);
      throw error;
    }
  },
};

module.exports = teamService;
