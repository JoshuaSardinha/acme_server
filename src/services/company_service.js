'use strict';

const db = require('../models');
const Company = db.Company;
const { Op } = require('sequelize');

const companyService = {
  findCompanyByUserId: async (userId) => {
    try {
      const company = await Company.findOne({
        where: { owner_id: userId },
        attributes: ['id', 'name', 'address', 'email'],
      });
      return company;
    } catch (error) {
      console.error('Error finding company by user ID:', error);
      throw error;
    }
  },

  createCompany: async (companyData) => {
    try {
      const company = await Company.create({
        name: companyData.name,
        address: companyData.address,
        email: companyData.email,
        phone_number: companyData.phone_number,
        owner_id: companyData.owner_id,
      });

      // Update the user's company_id
      await db.User.update(
        { company_id: company.id, role: 'vendor_admin' },
        { where: { id: companyData.owner_id } }
      );

      return company;
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  },

  getCompanyData: async (userId) => {
    try {
      const company = await Company.findOne({
        where: { owner_id: userId },
        attributes: ['id', 'name', 'address', 'email', 'phone_number'],
        include: [
          {
            model: db.User,
            as: 'owner',
            attributes: [
              'id',
              'first_name',
              'last_name',
              'email',
              'role',
              'is_lawyer',
              'company_id',
            ],
          },
        ],
      });

      if (!company) {
        return null;
      }

      return {
        id: company.id,
        name: company.name,
        address: company.address,
        email: company.email,
        phoneNumber: company.phone_number,
        owner: {
          id: company.owner.id,
          firstName: company.owner.first_name,
          lastName: company.owner.last_name,
          email: company.owner.email,
          role: company.owner.role,
          isLawyer: company.owner.is_lawyer,
          companyId: company.owner.company_id,
        },
      };
    } catch (error) {
      console.error('Error getting company data:', error);
      throw error;
    }
  },

  getCompanyUsers: async (companyId, { page, limit }) => {
    try {
      const offset = (page - 1) * limit;

      const { count, rows: users } = await db.User.findAndCountAll({
        where: { company_id: companyId },
        attributes: [
          'id',
          'first_name',
          'last_name',
          'email',
          'role',
          'is_lawyer',
          'company_id',
          'created_at',
        ],
        include: [
          {
            model: db.Team,
            as: 'teams',
            attributes: ['id', 'name'],
          },
        ],
        limit,
        offset,
        order: [['created_at', 'DESC']],
      });

      const formattedUsers = users.map((user) => ({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        isLawyer: user.is_lawyer,
        companyId: user.company_id,
        createdAt: user.created_at,
      }));

      return {
        users: formattedUsers,
        totalCount: count,
      };
    } catch (error) {
      console.error('Error getting users from company:', error);
      throw error;
    }
  },

  addUserToCompany: async (companyId, userId, role, isLawyer) => {
    try {
      const updatedUser = await db.User.update(
        { company_id: companyId, role: role, isLawyer: isLawyer },
        { where: { id: userId } }
      );
      return updatedUser;
    } catch (error) {
      console.error('Error adding user to company:', error);
      throw error;
    }
  },

  removeUserFromCompany: async (userId) => {
    try {
      const updatedUser = await db.User.update(
        { company_id: null, role: 'client' },
        { where: { id: userId } }
      );
      return updatedUser;
    } catch (error) {
      console.error('Error removing user from company:', error);
      throw error;
    }
  },

  getCompanyTeams: async (companyId) => {
    try {
      const teams = await db.Team.findAll({
        where: { company_id: companyId },
        attributes: ['id', 'name', 'company_id', 'owner_user_id'],
        include: [
          {
            model: db.User,
            as: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
          },
          {
            model: db.User,
            as: 'members',
            attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
            through: { attributes: [] },
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

      // Format the response to use camelCase
      return teams.map((team) => ({
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
    } catch (error) {
      console.error('Error getting company teams:', error);
      throw error;
    }
  },

  searchCompanyUsers: async (companyId, searchParams) => {
    try {
      const { searchValue = '', isLawyer, roles } = searchParams;

      // Build where clause
      const whereClause = {
        company_id: companyId,
      };

      // Add optional filters
      if (isLawyer !== undefined) {
        whereClause.is_lawyer = isLawyer === 'true';
      }

      if (roles && roles.length > 0) {
        const allowedRoles = [];

        roles.forEach((role) => {
          switch (role) {
            case 'employee':
              allowedRoles.push('vendor_employee', 'national_niner_employee');
              break;
            case 'manager':
              allowedRoles.push('vendor_manager', 'national_niner_manager');
              break;
            case 'admin':
              allowedRoles.push('vendor_admin', 'national_niner_admin');
              break;
          }
        });

        if (allowedRoles.length > 0) {
          whereClause.role = { [Op.in]: allowedRoles };
        }
      }

      // Add search conditions if searchValue is provided
      if (searchValue.trim()) {
        whereClause[Op.or] = [
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
        ];
      }

      const users = await db.User.findAll({
        where: whereClause,
        attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'is_lawyer', 'company_id'],
        limit: 10,
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
      console.error('Error searching company users:', error);
      throw error;
    }
  },
};

module.exports = companyService;
