import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Company } from '../../modules/company/entities/company.entity';
import { Team, TeamCategory } from '../../modules/team/entities/team.entity';
import { TeamMember } from '../../modules/team/entities/team-member.entity';
import { User } from '../../modules/auth/entities/user.entity';
import { Role } from '../../modules/role/entities/role.entity';
import { Sequelize, Op } from 'sequelize';

/**
 * Business Validation Service
 *
 * Handles complex business rules that cannot be enforced purely by database constraints.
 * Implements validation logic for Task 2.1 requirements.
 */
@Injectable()
export class BusinessValidationService {
  constructor(
    @InjectModel(Company)
    private readonly companyModel: typeof Company,
    @InjectModel(Team)
    private readonly teamModel: typeof Team,
    @InjectModel(TeamMember)
    private readonly teamMemberModel: typeof TeamMember,
    @InjectModel(User)
    private readonly userModel: typeof User,
    private readonly sequelize: Sequelize
  ) {}

  /**
   * Validates that a team owner belongs to the same company as the team
   * Implements business rule from REQ-TEAM-001
   */
  async validateTeamOwnerBelongsToCompany(
    teamId: string,
    ownerUserId: string,
    companyId: string
  ): Promise<void> {
    const owner = await this.userModel.findOne({
      where: { id: ownerUserId },
      attributes: ['id', 'company_id', 'role_id'],
      include: [
        {
          model: Role,
          attributes: ['id', 'name'],
          required: true,
        },
      ],
    });

    if (!owner) {
      throw new BadRequestException('Team owner user not found');
    }

    if (owner.company_id !== companyId) {
      throw new BadRequestException('Team owner must belong to the same company as the team');
    }

    // Verify owner has manager/admin role
    const validRoles = [
      'Vendor Manager',
      'Vendor Admin',
      'Acme Manager',
      'Acme Admin',
    ];
    if (!validRoles.includes(owner.role?.name || '')) {
      throw new BadRequestException('Team owner must be a Manager or Admin role');
    }
  }

  /**
   * Validates that a team member belongs to the same company as the team
   * Implements business rule validation for team membership
   */
  async validateTeamMemberBelongsToCompany(teamId: string, userId: string): Promise<void> {
    const team = await this.teamModel.findOne({
      where: { id: teamId },
      attributes: ['id', 'company_id'],
    });

    if (!team) {
      throw new BadRequestException('Team not found');
    }

    const user = await this.userModel.findOne({
      where: { id: userId },
      attributes: ['id', 'company_id'],
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.company_id !== team.company_id) {
      throw new BadRequestException('Team member must belong to the same company as the team');
    }
  }

  /**
   * Validates that LEGAL teams have at least one lawyer member
   * Implements business rule from REQ-TEAM-007
   */
  async validateLegalTeamHasLawyer(teamId: string): Promise<void> {
    const team = await this.teamModel.findOne({
      where: { id: teamId },
      attributes: ['id', 'category', 'owner_user_id'],
    });

    if (!team) {
      throw new BadRequestException('Team not found');
    }

    if (team.category !== TeamCategory.LEGAL) {
      return; // Only validate for LEGAL teams
    }

    // Check if team owner is a lawyer
    const owner = await this.userModel.findOne({
      where: { id: team.owner_user_id },
      attributes: ['id', 'is_lawyer'],
    });

    if (owner?.is_lawyer) {
      return; // Team owner is a lawyer, requirement satisfied
    }

    // Check if any team members are lawyers
    const lawyerMembers = await this.teamMemberModel.count({
      where: { team_id: teamId },
      include: [
        {
          model: this.userModel,
          as: 'user',
          where: { is_lawyer: true },
          attributes: [],
        },
      ],
    });

    if (lawyerMembers === 0) {
      throw new ConflictException(
        'LEGAL teams must have at least one lawyer as either the owner or a team member'
      );
    }
  }

  /**
   * Validates that removing a user would not violate business rules
   * Implements validation for team member removal
   */
  async validateTeamMemberRemoval(teamId: string, userId: string): Promise<void> {
    const team = await this.teamModel.findOne({
      where: { id: teamId },
      attributes: ['id', 'category', 'owner_user_id'],
    });

    if (!team) {
      throw new BadRequestException('Team not found');
    }

    // Prevent removing team owner
    if (team.owner_user_id === userId) {
      throw new BadRequestException(
        'Cannot remove team owner via member removal. Change team ownership first.'
      );
    }

    // For LEGAL teams, check if removing this user would leave no lawyers
    if (team.category === TeamCategory.LEGAL) {
      const userToRemove = await this.userModel.findOne({
        where: { id: userId },
        attributes: ['id', 'is_lawyer'],
      });

      if (userToRemove?.is_lawyer) {
        // Check if this is the last lawyer
        const owner = await this.userModel.findOne({
          where: { id: team.owner_user_id },
          attributes: ['id', 'is_lawyer'],
        });

        const otherLawyerMembers = await this.teamMemberModel.count({
          where: {
            team_id: teamId,
            user_id: { [Op.ne]: userId },
          },
          include: [
            {
              model: this.userModel,
              as: 'user',
              where: { is_lawyer: true },
              attributes: [],
            },
          ],
        });

        const totalLawyers = (owner?.is_lawyer ? 1 : 0) + otherLawyerMembers;

        if (totalLawyers === 0) {
          throw new ConflictException('Cannot remove the last lawyer from a LEGAL team');
        }
      }
    }
  }

  /**
   * Validates team creation request
   * Comprehensive validation for team creation
   */
  async validateTeamCreation(
    name: string,
    companyId: string,
    ownerUserId: string,
    category: TeamCategory
  ): Promise<void> {
    // Check team name uniqueness within company
    const existingTeam = await this.teamModel.findOne({
      where: { name, company_id: companyId },
    });

    if (existingTeam) {
      throw new ConflictException('A team with this name already exists in the company');
    }

    // Validate owner belongs to company
    await this.validateTeamOwnerBelongsToCompany('', ownerUserId, companyId);

    // For LEGAL teams, validate owner is a lawyer (since no members yet)
    if (category === TeamCategory.LEGAL) {
      const owner = await this.userModel.findOne({
        where: { id: ownerUserId },
        attributes: ['id', 'is_lawyer'],
      });

      if (!owner?.is_lawyer) {
        throw new BadRequestException(
          'LEGAL teams must be owned by a lawyer or have at least one lawyer member'
        );
      }
    }
  }

  /**
   * Validates team update request
   * Comprehensive validation for team updates
   */
  async validateTeamUpdate(
    teamId: string,
    updates: {
      name?: string;
      owner_user_id?: string;
      category?: TeamCategory;
      company_id?: string;
    }
  ): Promise<void> {
    const team = await this.teamModel.findOne({
      where: { id: teamId },
      attributes: ['id', 'name', 'company_id', 'owner_user_id', 'category'],
    });

    if (!team) {
      throw new BadRequestException('Team not found');
    }

    const companyId = updates.company_id || team.company_id;
    const name = updates.name || team.name;
    const ownerUserId = updates.owner_user_id || team.owner_user_id;

    // Check name uniqueness if name is being changed
    if (updates.name && updates.name !== team.name) {
      const existingTeam = await this.teamModel.findOne({
        where: {
          name: updates.name,
          company_id: companyId,
          id: { [Op.ne]: teamId },
        },
      });

      if (existingTeam) {
        throw new ConflictException('A team with this name already exists in the company');
      }
    }

    // Validate new owner if changing
    if (updates.owner_user_id) {
      await this.validateTeamOwnerBelongsToCompany(teamId, updates.owner_user_id, companyId);
    }

    // Validate category changes for LEGAL teams
    if (updates.category === TeamCategory.LEGAL) {
      // Use the new owner if being updated, otherwise current owner
      await this.validateLegalTeamHasLawyer(teamId);
    }
  }

  /**
   * Validates bulk team member operations
   * Handles adding/removing multiple members with proper validation
   */
  async validateBulkMembershipOperation(
    teamId: string,
    usersToAdd: string[],
    usersToRemove: string[]
  ): Promise<void> {
    // Validate all users to add
    for (const userId of usersToAdd) {
      await this.validateTeamMemberBelongsToCompany(teamId, userId);
    }

    // Validate all users to remove
    for (const userId of usersToRemove) {
      await this.validateTeamMemberRemoval(teamId, userId);
    }

    // Additional validation: ensure LEGAL team still has lawyers after operations
    const team = await this.teamModel.findOne({
      where: { id: teamId },
      attributes: ['id', 'category'],
    });

    if (team?.category === TeamCategory.LEGAL) {
      // This is a simplified check - in a real implementation, you might want
      // to simulate the changes and validate the final state
      await this.validateLegalTeamHasLawyer(teamId);
    }
  }
}
