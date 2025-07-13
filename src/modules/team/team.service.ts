import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Team, TeamCategory } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { User, UserRole } from '../auth/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { Role } from '../role/entities/role.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamValidationService } from './services/team-validation.service';
import { MembershipValidationService } from './services/membership-validation.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectModel(Team)
    private teamModel: typeof Team,
    @InjectModel(TeamMember)
    private teamMemberModel: typeof TeamMember,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Company)
    private companyModel: typeof Company,
    private sequelize: Sequelize,
    private teamValidationService: TeamValidationService,
    private membershipValidationService: MembershipValidationService
  ) {}

  async getTeamById(teamId: string): Promise<Team | null> {
    try {
      const team = await this.teamModel.findOne({ where: { id: teamId } });
      return team;
    } catch (error) {
      this.logger.error('Error finding team:', error);
      throw error;
    }
  }

  async getTeamDetails(teamId: string): Promise<Team | null> {
    try {
      const team = await this.teamModel.findOne({
        where: { id: teamId },
        include: [
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'email'],
          },
          {
            model: User,
            as: 'members',
            attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
            through: { attributes: [] },
          },
        ],
      });
      return team;
    } catch (error) {
      this.logger.error('Error getting team details:', error);
      throw error;
    }
  }

  async updateTeam(teamId: string, updateTeamDto: UpdateTeamDto): Promise<Team | null> {
    try {
      const [affectedRows] = await this.teamModel.update(updateTeamDto, { where: { id: teamId } });

      if (affectedRows === 0) {
        return null;
      }

      return await this.getTeamDetails(teamId);
    } catch (error) {
      this.logger.error('Error updating team:', error);
      throw error;
    }
  }

  async createTeam(createTeamDto: CreateTeamDto, companyId: string): Promise<Team> {
    try {
      // Validate team creation with comprehensive business rules
      await this.teamValidationService.validateTeamCreation(
        createTeamDto.name,
        companyId,
        createTeamDto.ownerUserId,
        createTeamDto.memberIds
      );

      const team = await this.teamModel.create({
        name: createTeamDto.name,
        company_id: companyId,
        owner_user_id: createTeamDto.ownerUserId,
        category: createTeamDto.category || TeamCategory.CONVENTIONAL,
      });

      // Validate and add team members
      await this.membershipValidationService.validateUsersCanJoinTeam(
        createTeamDto.memberIds,
        team.id
      );

      for (const userId of createTeamDto.memberIds) {
        await this.teamMemberModel.create({
          team_id: team.id,
          user_id: userId,
        });
      }

      return team;
    } catch (error) {
      this.logger.error('Error creating team:', error);
      throw error;
    }
  }

  async getTeamsData(userId: string): Promise<any[]> {
    try {
      const teams = await this.teamModel.findAll({
        attributes: ['id', 'name', 'company_id', 'owner_user_id'],
        include: [
          {
            model: User,
            as: 'members',
            attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
            through: { attributes: [] },
          },
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
          },
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name', 'address', 'email', 'phone_number'],
            include: [
              {
                model: User,
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
          id: team.owner.id,
          firstName: team.owner.first_name,
          lastName: team.owner.last_name,
          email: team.owner.email,
          role: team.owner.role,
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
      this.logger.error('Error getting team data:', error);
      throw error;
    }
  }

  async getTeamByUserIdAndTeamId(userId: string, teamId: string): Promise<any | null> {
    try {
      const team = await this.teamModel.findOne({
        where: { id: teamId },
        attributes: ['id', 'name', 'company_id', 'owner_user_id'],
        include: [
          {
            model: User,
            as: 'members',
            through: {
              where: { user_id: userId },
              attributes: [],
            },
            attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
            required: true,
          },
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
          },
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name', 'address', 'email', 'phone_number'],
            include: [
              {
                model: User,
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
          id: team.owner.id,
          firstName: team.owner.first_name,
          lastName: team.owner.last_name,
          email: team.owner.email,
          role: team.owner.role,
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
      this.logger.error('Error getting team data:', error);
      throw error;
    }
  }

  async getTeamUsers(teamId: string): Promise<any> {
    try {
      const users = await this.userModel.findAll({
        attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'is_lawyer', 'company_id'],
        include: [
          {
            model: Team,
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
      this.logger.error('Error getting users from company:', error);
      throw error;
    }
  }

  async createTeamMembers(userIds: string[], teamId: string): Promise<TeamMember[]> {
    try {
      // Validate users can join the team
      await this.membershipValidationService.validateUsersCanJoinTeam(userIds, teamId);

      const teamMembers = await Promise.all(
        userIds.map((userId) =>
          this.teamMemberModel.create({
            team_id: teamId,
            user_id: userId,
          })
        )
      );
      return teamMembers;
    } catch (error) {
      this.logger.error('Error adding users to team:', error);
      throw error;
    }
  }

  async removeUsersFromTeam(teamId: string, userIds: string[]): Promise<void> {
    try {
      await this.teamMemberModel.destroy({
        where: {
          team_id: teamId,
          user_id: { [Op.in]: userIds },
        },
      });
    } catch (error) {
      this.logger.error('Error removing users from team:', error);
      throw error;
    }
  }

  async deleteTeam(teamId: string): Promise<void> {
    try {
      await this.teamModel.destroy({
        where: { id: teamId },
      });
    } catch (error) {
      this.logger.error('Error deleting team:', error);
      throw error;
    }
  }

  async searchUsersForTeam(teamId: string, searchValue: string, companyId: string): Promise<any> {
    try {
      const currentTeamMembers = await this.teamMemberModel.findAll({
        where: { team_id: teamId },
        attributes: ['user_id'],
      });

      const currentMemberIds = currentTeamMembers.map((member) => member.user_id);

      const users = await this.userModel.findAll({
        where: {
          company_id: companyId,
          id: {
            [Op.notIn]: currentMemberIds,
          },
          [Op.or]: [
            this.sequelize.where(
              this.sequelize.fn('LOWER', this.sequelize.col('first_name')),
              'LIKE',
              `%${searchValue.toLowerCase()}%`
            ),
            this.sequelize.where(
              this.sequelize.fn('LOWER', this.sequelize.col('last_name')),
              'LIKE',
              `%${searchValue.toLowerCase()}%`
            ),
            this.sequelize.where(
              this.sequelize.fn('LOWER', this.sequelize.col('email')),
              'LIKE',
              `%${searchValue.toLowerCase()}%`
            ),
          ],
        },
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
      this.logger.error('Error searching users for team:', error);
      throw error;
    }
  }

  async changeTeamManager(teamId: string, newManagerId: string): Promise<boolean> {
    try {
      // Validate manager change
      await this.teamValidationService.validateManagerChange(teamId, newManagerId);

      // Remove new manager from regular members if they exist
      await this.teamMemberModel.destroy({
        where: {
          team_id: teamId,
          user_id: newManagerId,
        },
      });

      const [updatedRows] = await this.teamModel.update(
        { owner_user_id: newManagerId },
        { where: { id: teamId } }
      );

      if (updatedRows === 0) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error changing team manager:', error);
      throw error;
    }
  }

  async replaceTeamUsers(teamId: string, userIds: string[]): Promise<void> {
    try {
      // Validate membership replacement
      await this.membershipValidationService.validateMembershipReplacement(teamId, userIds);

      await this.sequelize.transaction(async (t) => {
        await this.teamMemberModel.destroy({
          where: { team_id: teamId },
          transaction: t,
        });

        if (userIds.length > 0) {
          await Promise.all(
            userIds.map((userId) =>
              this.teamMemberModel.create(
                {
                  team_id: teamId,
                  user_id: userId,
                },
                { transaction: t }
              )
            )
          );
        }
      });
    } catch (error) {
      this.logger.error('Error replacing team users:', error);
      throw error;
    }
  }

  // ================== NEW IMPROVED CRUD METHODS ==================

  /**
   * Create a new team with proper validation and transaction support
   */
  async create(createTeamDto: CreateTeamDto, currentUser: any): Promise<Team> {
    const { name, description, category, ownerUserId, memberIds } = createTeamDto;

    // Derive company_id from current user context for security
    const companyId =
      currentUser.hasRoleEnum && currentUser.hasRoleEnum(UserRole.ACME_ADMIN)
        ? createTeamDto.companyId // ACME_ADMIN can specify
        : currentUser.company_id; // Others use their own

    const transaction = await this.sequelize.transaction();

    try {
      // Validate company exists
      const company = await this.companyModel.findByPk(companyId, { transaction });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      // Validate owner is Manager/Admin in same company
      const owner = await this.userModel.findOne({
        where: {
          id: ownerUserId,
          company_id: companyId,
        },
        include: [{ model: Role, as: 'role' }],
        transaction,
      });

      if (!owner) {
        throw new BadRequestException('Owner user not found in company');
      }

      const isValidOwner =
        owner.hasRoleEnum(UserRole.VENDOR_MANAGER) ||
        owner.hasRoleEnum(UserRole.VENDOR_ADMIN) ||
        owner.hasRoleEnum(UserRole.ACME_ADMIN) ||
        owner.hasRoleEnum(UserRole.ACME_MANAGER);

      if (!isValidOwner) {
        throw new BadRequestException(
          'Invalid owner - must be Manager or Admin role in same company'
        );
      }

      // Validate team name uniqueness within company
      const existing = await this.teamModel.findOne({
        where: { name, company_id: companyId },
        transaction,
      });
      if (existing) {
        throw new ConflictException('Team name already exists in this company');
      }

      // Validate all members exist and belong to company
      const members = await this.userModel.findAll({
        where: {
          id: memberIds,
          company_id: companyId,
        },
        transaction,
      });
      if (members.length !== memberIds.length) {
        throw new BadRequestException('One or more members not found in company');
      }

      // Ensure owner is included in members
      if (!memberIds.includes(ownerUserId)) {
        throw new BadRequestException('Team owner must be included as a member');
      }

      // Validate LEGAL team has lawyer
      if (category === TeamCategory.LEGAL) {
        await this.validateLegalTeamHasLawyer(memberIds, transaction);
      }

      // Create team
      const team = await this.teamModel.create(
        {
          name,
          description,
          category,
          company_id: companyId,
          owner_user_id: ownerUserId,
        },
        { transaction }
      );

      // Add members
      await Promise.all(
        memberIds.map((userId) =>
          this.teamMemberModel.create(
            {
              team_id: team.id,
              user_id: userId,
              added_by_user_id: currentUser.id,
            },
            { transaction }
          )
        )
      );

      await transaction.commit();

      this.logger.log(`Team '${name}' created successfully with ID: ${team.id}`);

      // Return with associations
      return this.findOne({ company_id: companyId } as User, team.id);
    } catch (error) {
      await transaction.rollback();
      this.logger.error('Failed to create team', error);
      throw error;
    }
  }

  /**
   * Find all teams with pagination and proper scoping
   */
  async findAllPaginated(
    paginationDto: PaginationDto,
    currentUser: any
  ): Promise<PaginatedResponseDto<Team>> {
    const { page = 1, limit = 10 } = paginationDto;
    const offset = (page - 1) * limit;

    // Apply company scoping based on user role
    const whereClause: any = {};
    if (!currentUser.hasRoleEnum || !currentUser.hasRoleEnum(UserRole.ACME_ADMIN)) {
      whereClause.company_id = currentUser.company_id;
    }

    try {
      const { count, rows } = await this.teamModel.findAndCountAll({
        where: whereClause,
        attributes: [
          'id',
          'name',
          'description',
          'category',
          'company_id',
          'owner_user_id',
          'is_active',
          'created_at',
          'updated_at',
        ],
        include: [
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'email'],
          },
          {
            model: User,
            as: 'members',
            attributes: ['id', 'first_name', 'last_name', 'email', 'is_lawyer'],
            through: { attributes: [] },
          },
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name'],
          },
        ],
        limit,
        offset,
        order: [['created_at', 'DESC']],
      });

      return {
        data: rows,
        meta: {
          currentPage: page,
          itemCount: count,
          itemsPerPage: limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error finding teams with pagination', error);
      throw error;
    }
  }

  async findAll(currentUser: User, query: any): Promise<Team[]> {
    return this.teamModel.findAll({
      where: {
        company_id: currentUser.company_id,
      },
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: User,
          as: 'members',
          attributes: ['id', 'first_name', 'last_name', 'email'],
          through: { attributes: [] },
        },
      ],
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });
  }

  /**
   * Find a team by ID with proper company scoping
   */
  async findOne(currentUser: User, id: string): Promise<Team> {
    try {
      // Build where clause conditionally based on company_id
      const whereClause: any = { id };
      if (currentUser.company_id !== undefined) {
        whereClause.company_id = currentUser.company_id;
      }

      const team = await this.teamModel.findOne({
        where: whereClause,
        attributes: [
          'id',
          'name',
          'description',
          'category',
          'company_id',
          'owner_user_id',
          'is_active',
          'created_at',
          'updated_at',
        ],
        include: [
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'email'],
          },
          {
            model: User,
            as: 'members',
            attributes: ['id', 'first_name', 'last_name', 'email', 'is_lawyer'],
            through: { attributes: [] },
          },
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name'],
          },
        ],
      });

      if (!team) {
        throw new NotFoundException(`Team with ID '${id}' not found`);
      }

      return team;
    } catch (error) {
      this.logger.error('Error finding team', error);
      throw error;
    }
  }

  /**
   * Finds a single team for a given user, enforcing authorization rules.
   * An ACME_ADMIN can access any team.
   * A regular user can only access teams within their own company.
   * @param teamId The ID of the team to find.
   * @param user The user requesting the team.
   * @throws NotFoundException if the team doesn't exist or the user cannot access it.
   */
  async findOneForUser(teamId: string, user: any): Promise<Team> {
    try {
      // Business logic is now encapsulated in the service layer
      const companyId = user.hasRoleEnum(UserRole.ACME_ADMIN) ? undefined : user.company_id;

      // Call the existing findOne method with proper authorization
      return await this.findOne({ company_id: companyId } as User, teamId);
    } catch (error) {
      this.logger.error(`Error finding team for user ${user.id}:`, error);
      throw error;
    }
  }

  /**
   * Update a team with proper validation and transaction support
   */
  async update(currentUser: User, id: string, updateTeamDto: any): Promise<Team> {
    const { name, description, category, ownerUserId, memberIds, isActive } = updateTeamDto;

    const companyId = currentUser.company_id;

    const transaction = await this.sequelize.transaction();

    try {
      // Fetch current team state
      const currentTeam = await this.teamModel.findOne({
        where: { id, company_id: companyId },
        include: [{ model: User, as: 'members' }],
        transaction,
      });

      if (!currentTeam) {
        throw new NotFoundException(`Team with ID '${id}' not found`);
      }

      // Check for name conflicts if name is being updated
      if (name && name !== currentTeam.name) {
        const existing = await this.teamModel.findOne({
          where: {
            name,
            company_id: companyId,
            id: { [Op.ne]: id }, // Exclude current team
          },
          transaction,
        });
        if (existing) {
          throw new ConflictException('Team name already exists in this company');
        }
      }

      // Update team
      await this.teamModel.update(
        {
          name,
          description,
          category,
          owner_user_id: ownerUserId,
          is_active: isActive,
        },
        {
          where: { id, company_id: companyId },
          transaction,
        }
      );

      await transaction.commit();

      this.logger.log(`Team with ID: ${id} updated successfully`);

      return this.findOne(currentUser, id);
    } catch (error) {
      await transaction.rollback();
      this.logger.error('Failed to update team', error);
      throw error;
    }
  }

  /**
   * Remove a team with proper validation
   */
  async remove(currentUser: User, id: string): Promise<void> {
    const companyId = currentUser.company_id;

    const transaction = await this.sequelize.transaction();

    try {
      // Fetch team and its members
      const team = await this.teamModel.findOne({
        where: { id, company_id: companyId },
        include: [{ model: User, as: 'members', attributes: ['id'] }],
        transaction,
      });

      if (!team) {
        throw new NotFoundException(`Team with ID '${id}' not found`);
      }

      // Remove team members first
      await this.teamMemberModel.destroy({
        where: { team_id: id },
        transaction,
      });

      // Remove team
      await this.teamModel.destroy({
        where: { id, company_id: companyId },
        transaction,
      });

      await transaction.commit();

      this.logger.log(`Team with ID: ${id} removed successfully`);
    } catch (error) {
      await transaction.rollback();
      this.logger.error('Failed to remove team', error);
      throw error;
    }
  }

  /**
   * Add members to a team
   */
  async addMembers(teamId: string, userIds: string[], currentUser: any): Promise<Team> {
    const companyId = currentUser.hasRoleEnum(UserRole.ACME_ADMIN)
      ? undefined
      : currentUser.company_id;

    const transaction = await this.sequelize.transaction();

    try {
      // Validate team exists and belongs to user's company
      const team = await this.findOne({ company_id: companyId } as User, teamId);

      // Validate users exist and belong to same company
      const members = await this.userModel.findAll({
        where: {
          id: userIds,
          company_id: team.company_id,
        },
        transaction,
      });

      if (members.length !== userIds.length) {
        throw new BadRequestException('One or more users not found in company');
      }

      // Check if users are already members
      const existing = await this.teamMemberModel.findAll({
        where: {
          team_id: teamId,
          user_id: userIds,
        },
        transaction,
      });

      const existingUserIds = existing.map((tm) => tm.user_id);
      const newUserIds = userIds.filter((id) => !existingUserIds.includes(id));

      if (newUserIds.length === 0) {
        throw new BadRequestException('All specified users are already members of this team');
      }

      // Add new members
      await Promise.all(
        newUserIds.map((userId) =>
          this.teamMemberModel.create(
            {
              team_id: teamId,
              user_id: userId,
              added_by_user_id: currentUser.id,
            },
            { transaction }
          )
        )
      );

      await transaction.commit();

      this.logger.log(`Added ${newUserIds.length} members to team ${teamId}`);

      return this.findOne({ company_id: companyId } as User, teamId);
    } catch (error) {
      await transaction.rollback();
      this.logger.error('Failed to add members to team', error);
      throw error;
    }
  }

  async addMember(currentUser: User, teamId: string, userId: string): Promise<TeamMember> {
    return this.sequelize.transaction(async (transaction) => {
      // Find the team and ensure it exists and user has access
      const team = await this.teamModel.findOne({
        where: {
          id: teamId,
          company_id: currentUser.company_id,
        },
        transaction,
      });

      if (!team) {
        throw new NotFoundException('Team not found');
      }

      // Find the user to add
      const userToAdd = await this.userModel.findByPk(userId, { transaction });
      if (!userToAdd) {
        throw new NotFoundException('User not found');
      }

      // Validate membership addition
      await this.membershipValidationService.validateMembershipAddition(
        team,
        userToAdd,
        currentUser
      );

      // Create the team member
      const teamMember = await this.teamMemberModel.create(
        {
          team_id: teamId,
          user_id: userId,
          added_by_user_id: currentUser.id,
        },
        { transaction }
      );

      return teamMember;
    });
  }

  /**
   * Remove a member from a team
   */
  async removeMember(currentUser: User, teamId: string, userId: string): Promise<void> {
    const companyId = currentUser.hasRoleEnum(UserRole.ACME_ADMIN)
      ? undefined
      : currentUser.company_id;

    const transaction = await this.sequelize.transaction();

    try {
      // Validate team exists and belongs to user's company
      const team = await this.teamModel.findOne({
        where: companyId ? { id: teamId, company_id: companyId } : { id: teamId },
        include: [{ model: User, as: 'members', attributes: ['id', 'is_lawyer'] }],
        transaction,
      });

      if (!team) {
        throw new NotFoundException('Team not found');
      }

      // Validate membership removal
      await this.membershipValidationService.validateMembershipRemoval(team, userId, currentUser);

      // Check if user is a member
      const membership = await this.teamMemberModel.findOne({
        where: {
          team_id: teamId,
          user_id: userId,
        },
        transaction,
      });

      if (!membership) {
        throw new BadRequestException('User is not a member of this team');
      }

      // Remove member
      await this.teamMemberModel.destroy({
        where: {
          team_id: teamId,
          user_id: userId,
        },
        transaction,
      });

      await transaction.commit();

      this.logger.log(`Removed user ${userId} from team ${teamId}`);
    } catch (error) {
      await transaction.rollback();
      this.logger.error('Failed to remove member from team', error);
      throw error;
    }
  }

  // ================== PRIVATE VALIDATION METHODS ==================

  private async validateLegalTeamHasLawyer(
    memberIds: string[],
    transaction?: Transaction
  ): Promise<void> {
    const members = await this.userModel.findAll({
      where: { id: memberIds },
      attributes: ['id', 'is_lawyer'],
      transaction,
    });

    const hasLawyer = members.some((m) => m.is_lawyer);
    if (!hasLawyer) {
      throw new BadRequestException('A LEGAL team must have at least one member who is a lawyer');
    }
  }
}
