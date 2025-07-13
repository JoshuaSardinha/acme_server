import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { TeamMember } from '../entities/team-member.entity';
import { Team } from '../entities/team.entity';
import { User } from '../../auth/entities/user.entity';
import { Role } from '../../role/entities/role.entity';
import { Company } from '../../company/entities/company.entity';
import { TeamCategory } from './team-validation.service';

@Injectable()
export class MembershipValidationService {
  constructor(
    @InjectModel(TeamMember)
    private teamMemberModel: typeof TeamMember,
    @InjectModel(Team)
    private teamModel: typeof Team,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Company)
    private companyModel: typeof Company
  ) {}

  /**
   * Validates that a user can be added to a team
   */
  async validateUserCanJoinTeam(userId: string, teamId: string): Promise<void> {
    // Check if user exists
    const user = await this.userModel.findByPk(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if team exists
    const team = await this.teamModel.findByPk(teamId, {
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id'],
        },
      ],
    });
    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Validate user belongs to same company as team
    if (user.company_id !== team.company_id) {
      throw new BadRequestException(
        `User cannot join team from different company. User company: ${user.company_id}, Team company: ${team.company_id}`
      );
    }

    // Check if user is already a member
    const existingMembership = await this.teamMemberModel.findOne({
      where: {
        team_id: teamId,
        user_id: userId,
      },
    });

    if (existingMembership) {
      throw new BadRequestException(`User ${userId} is already a member of team ${teamId}`);
    }

    // Check if user is the team manager
    if (team.owner_user_id === userId) {
      throw new BadRequestException('Team manager cannot be added as a regular team member');
    }
  }

  /**
   * Validates that multiple users can be added to a team
   */
  async validateUsersCanJoinTeam(userIds: string[], teamId: string): Promise<void> {
    if (!userIds || userIds.length === 0) {
      return;
    }

    for (const userId of userIds) {
      await this.validateUserCanJoinTeam(userId, teamId);
    }
  }

  /**
   * Validates that a user can be removed from a team
   */
  async validateUserCanLeaveTeam(
    userId: string,
    teamId: string,
    category?: TeamCategory
  ): Promise<void> {
    // Get the team to check ownership
    const team = await this.teamModel.findByPk(teamId);
    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // CRITICAL: Cannot remove the team owner
    if (team.owner_user_id === userId) {
      throw new BadRequestException('Cannot remove the team owner');
    }

    // Check if user is actually a member
    const membership = await this.teamMemberModel.findOne({
      where: {
        team_id: teamId,
        user_id: userId,
      },
    });

    if (!membership) {
      throw new BadRequestException(`User is not a member of this team`);
    }

    // For LEGAL teams, ensure we don't remove the last lawyer
    if (category === TeamCategory.LEGAL) {
      await this.validateLegalTeamLawyerRequirementAfterRemoval(teamId, [userId]);
    }
  }

  /**
   * Validates that multiple users can be removed from a team
   */
  async validateUsersCanLeaveTeam(
    userIds: string[],
    teamId: string,
    category?: TeamCategory
  ): Promise<void> {
    if (!userIds || userIds.length === 0) {
      return;
    }

    // Check all users are actually members
    const memberships = await this.teamMemberModel.findAll({
      where: {
        team_id: teamId,
        user_id: userIds,
      },
    });

    if (memberships.length !== userIds.length) {
      const foundUserIds = memberships.map((m) => m.user_id);
      const missingUserIds = userIds.filter((id) => !foundUserIds.includes(id));
      throw new NotFoundException(
        `The following users are not members of the team: ${missingUserIds.join(', ')}`
      );
    }

    // For LEGAL teams, ensure we don't remove all lawyers
    if (category === TeamCategory.LEGAL) {
      await this.validateLegalTeamLawyerRequirementAfterRemoval(teamId, userIds);
    }
  }

  /**
   * Validates membership replacements (complete member list change)
   */
  async validateMembershipReplacement(
    teamId: string,
    newMemberIds: string[],
    category?: TeamCategory
  ): Promise<void> {
    const team = await this.teamModel.findByPk(teamId, {
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id'],
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'is_lawyer'],
        },
      ],
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Validate all new members belong to same company
    if (newMemberIds.length > 0) {
      await this.validateNewMembersBelongToCompany(newMemberIds, team.company_id);

      // Ensure manager is not in the new member list
      if (newMemberIds.includes(team.owner_user_id)) {
        throw new BadRequestException('Team manager cannot be included in the regular member list');
      }
    }

    // For LEGAL teams, ensure at least one lawyer remains
    if (category === TeamCategory.LEGAL) {
      await this.validateLegalTeamHasLawyerAfterReplacement(team, newMemberIds);
    }
  }

  /**
   * Validates bulk membership operations with transaction support
   */
  async validateBulkMembershipOperation(
    teamId: string,
    operations: {
      add?: string[];
      remove?: string[];
      replace?: string[];
    },
    category?: TeamCategory
  ): Promise<void> {
    const { add = [], remove = [], replace } = operations;

    // If it's a replacement operation, use that validation
    if (replace) {
      await this.validateMembershipReplacement(teamId, replace, category);
      return;
    }

    // Validate additions
    if (add.length > 0) {
      await this.validateUsersCanJoinTeam(add, teamId);
    }

    // Validate removals
    if (remove.length > 0) {
      await this.validateUsersCanLeaveTeam(remove, teamId, category);
    }

    // Validate no overlap between add and remove
    const overlap = add.filter((id) => remove.includes(id));
    if (overlap.length > 0) {
      throw new BadRequestException(
        `Cannot add and remove the same users in one operation: ${overlap.join(', ')}`
      );
    }
  }

  /**
   * Validates user permissions for membership operations
   */
  async validateMembershipOperationPermissions(
    requestingUserId: string,
    teamId: string,
    operation: 'add' | 'remove' | 'replace'
  ): Promise<void> {
    const user = await this.userModel.findByPk(requestingUserId, {
      include: [
        {
          model: Role,
          attributes: ['id', 'name'],
          required: true,
        },
      ],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${requestingUserId} not found`);
    }

    const team = await this.teamModel.findByPk(teamId, {
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'owner_id'],
        },
      ],
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Check if user has permission to modify team membership
    const isTeamManager = team.owner_user_id === requestingUserId;
    const isCompanyOwner = team.company.owner_id === requestingUserId;
    const isAcmeEmployee = ['Acme Admin', 'Acme Manager', 'Acme Employee'].includes(
      user.role?.name || ''
    );
    const isVendorAdmin = user.role?.name === 'Vendor Admin' && user.company_id === team.company_id;

    if (!isTeamManager && !isCompanyOwner && !isAcmeEmployee && !isVendorAdmin) {
      throw new ForbiddenException(
        'Insufficient permissions to modify team membership. Only team managers, company owners, or Acme employees can perform this operation.'
      );
    }
  }

  /**
   * Private helper: Validates that new members belong to the correct company
   */
  private async validateNewMembersBelongToCompany(
    memberIds: string[],
    companyId: string
  ): Promise<void> {
    const members = await this.userModel.findAll({
      where: { id: memberIds },
      attributes: ['id', 'company_id', 'first_name', 'last_name'],
    });

    if (members.length !== memberIds.length) {
      const foundMemberIds = members.map((m) => m.id);
      const missingMemberIds = memberIds.filter((id) => !foundMemberIds.includes(id));
      throw new NotFoundException(`Users not found: ${missingMemberIds.join(', ')}`);
    }

    const invalidMembers = members.filter((member) => member.company_id !== companyId);
    if (invalidMembers.length > 0) {
      const invalidMemberInfo = invalidMembers
        .map(
          (m) =>
            `${m.first_name} ${m.last_name} (${m.id}) belongs to company ${m.company_id || 'none'}`
        )
        .join(', ');
      throw new BadRequestException(
        `All team members must belong to the same company. Invalid members: ${invalidMemberInfo}`
      );
    }
  }

  /**
   * Private helper: Validates LEGAL team lawyer requirement after user removal
   */
  private async validateLegalTeamLawyerRequirementAfterRemoval(
    teamId: string,
    removeUserIds: string[]
  ): Promise<void> {
    const team = await this.teamModel.findByPk(teamId, {
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id', 'is_lawyer'],
          through: { attributes: [] },
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'is_lawyer'],
        },
      ],
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Check if manager is a lawyer
    const managerIsLawyer = (team as any).owner?.is_lawyer || false;

    // Get remaining lawyer members after removal
    const remainingLawyerMembers =
      team.members?.filter((member) => member.is_lawyer && !removeUserIds.includes(member.id)) ||
      [];

    if (!managerIsLawyer && remainingLawyerMembers.length === 0) {
      throw new BadRequestException(
        'Cannot remove all lawyers from a LEGAL team. At least one lawyer must remain as either the manager or a team member'
      );
    }
  }

  /**
   * Private helper: Validates LEGAL team has lawyer after membership replacement
   */
  private async validateLegalTeamHasLawyerAfterReplacement(
    team: Team & { owner: User },
    newMemberIds: string[]
  ): Promise<void> {
    // Check if manager is a lawyer
    const managerIsLawyer = (team as any).owner?.is_lawyer || false;

    if (newMemberIds.length === 0 && !managerIsLawyer) {
      throw new BadRequestException(
        'LEGAL teams must have at least one lawyer. Cannot have an empty member list when the manager is not a lawyer'
      );
    }

    if (newMemberIds.length > 0) {
      // Get new members and check if any are lawyers
      const newMembers = await this.userModel.findAll({
        where: { id: newMemberIds },
        attributes: ['id', 'is_lawyer'],
      });

      const hasLawyerMember = newMembers.some((member) => member.is_lawyer);

      if (!managerIsLawyer && !hasLawyerMember) {
        throw new BadRequestException(
          'LEGAL teams must have at least one lawyer as either the manager or a team member'
        );
      }
    }
  }

  /**
   * Creates a comprehensive membership audit log entry
   */
  async logMembershipChange(
    teamId: string,
    operation: 'add' | 'remove' | 'replace',
    userIds: string[],
    performedBy: string,
    transaction?: Transaction
  ): Promise<void> {
    // This would integrate with an audit logging system
    // For now, we'll just log to console, but in production this should
    // write to an audit table or external logging service
    const timestamp = new Date().toISOString();
    console.log(`[AUDIT] ${timestamp} - Team Membership ${operation.toUpperCase()}`, {
      teamId,
      userIds,
      performedBy,
      operation,
    });
  }

  async validateMembershipAddition(team: any, userToAdd: any, currentUser: any): Promise<void> {
    // Validate that user can join the team
    await this.validateUserCanJoinTeam(userToAdd.id, team.id);

    // Validate permissions for the operation
    await this.validateMembershipOperationPermissions(currentUser.id, team.id, 'add');
  }

  async validateMembershipRemoval(team: any, userId: string, currentUser: any): Promise<void> {
    // Find the user being removed
    const userToRemove = await this.userModel.findByPk(userId);
    if (!userToRemove) {
      throw new Error('User not found');
    }

    // Validate that user can leave the team
    await this.validateUserCanLeaveTeam(userId, team.id, team.category);

    // Validate permissions for the operation
    await this.validateMembershipOperationPermissions(currentUser.id, team.id, 'remove');
  }
}
