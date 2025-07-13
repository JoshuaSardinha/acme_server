import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { User } from '../../auth/entities/user.entity';
import { Company } from '../../company/entities/company.entity';

export enum TeamCategory {
  LEGAL = 'LEGAL',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  SUPPORT = 'SUPPORT',
  MARKETING = 'MARKETING',
  TECHNICAL = 'TECHNICAL',
}

@Injectable()
export class TeamValidationService {
  constructor(
    @InjectModel(Team)
    private teamModel: typeof Team,
    @InjectModel(TeamMember)
    private teamMemberModel: typeof TeamMember,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Company)
    private companyModel: typeof Company
  ) {}

  /**
   * Validates that a team owner (manager) belongs to the same company as the team
   */
  async validateTeamOwnerCompany(managerId: string, companyId: string): Promise<void> {
    const manager = await this.userModel.findByPk(managerId);
    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    if (manager.company_id !== companyId) {
      throw new BadRequestException(
        `Team manager must belong to the same company as the team. Manager belongs to company ${manager.company_id || 'none'}, but team is in company ${companyId}`
      );
    }
  }

  /**
   * Validates that all team members belong to the same company as the team
   */
  async validateTeamMembersCompany(memberIds: string[], companyId: string): Promise<void> {
    if (!memberIds || memberIds.length === 0) {
      return;
    }

    const members = await this.userModel.findAll({
      where: { id: memberIds },
      attributes: ['id', 'company_id', 'first_name', 'last_name'],
    });

    if (members.length !== memberIds.length) {
      const foundMemberIds = members.map((m) => m.id);
      const missingMemberIds = memberIds.filter((id) => !foundMemberIds.includes(id));
      throw new NotFoundException(`Team members not found: ${missingMemberIds.join(', ')}`);
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
        `All team members must belong to the same company as the team. Invalid members: ${invalidMemberInfo}`
      );
    }
  }

  /**
   * Validates that LEGAL category teams have at least one lawyer member
   */
  async validateLegalTeamLawyerRequirement(teamId: string, category?: TeamCategory): Promise<void> {
    // This validation only applies to LEGAL teams
    if (category !== TeamCategory.LEGAL) {
      return;
    }

    const team = await this.teamModel.findByPk(teamId, {
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id', 'is_lawyer', 'first_name', 'last_name'],
          through: { attributes: [] },
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'is_lawyer', 'first_name', 'last_name'],
        },
      ],
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Check if owner is a lawyer
    const ownerIsLawyer = (team as any).owner?.is_lawyer || false;

    // Check if any member is a lawyer
    const hasLawyerMember = (team as any).members?.some((member: any) => member.is_lawyer) || false;

    if (!ownerIsLawyer && !hasLawyerMember) {
      throw new BadRequestException(
        'LEGAL teams must have at least one lawyer as either the owner or a team member'
      );
    }
  }

  /**
   * Validates that a team exists and belongs to a specific company
   */
  async validateTeamExistsInCompany(teamId: string, companyId: string): Promise<Team> {
    const team = await this.teamModel.findOne({
      where: { id: teamId, company_id: companyId },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found in company ${companyId}`);
    }

    return team;
  }

  /**
   * Validates team creation with comprehensive business rules
   */
  async validateTeamCreation(
    teamName: string,
    companyId: string,
    managerId: string,
    memberIds: string[],
    category?: TeamCategory
  ): Promise<void> {
    // Validate company exists
    const company = await this.companyModel.findByPk(companyId);
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    // Validate team name uniqueness within company
    await this.validateTeamNameUniqueness(companyId, teamName);

    // Validate manager belongs to company
    await this.validateTeamOwnerCompany(managerId, companyId);

    // Validate all members belong to company
    await this.validateTeamMembersCompany(memberIds, companyId);

    // Validate manager is not in member list (to avoid duplication)
    if (memberIds.includes(managerId)) {
      throw new BadRequestException('Team manager cannot also be listed as a regular team member');
    }
  }

  /**
   * Validates team update with business rules
   */
  async validateTeamUpdate(
    teamId: string,
    companyId: string,
    updateData: {
      name?: string;
      managerId?: string;
      memberIds?: string[];
      category?: TeamCategory;
    }
  ): Promise<void> {
    // Validate team exists in company
    const team = await this.validateTeamExistsInCompany(teamId, companyId);

    // Validate name uniqueness if name is being updated
    if (updateData.name && updateData.name !== team.name) {
      await this.validateTeamNameUniqueness(companyId, updateData.name, teamId);
    }

    // Validate new manager if being updated
    if (updateData.managerId) {
      await this.validateTeamOwnerCompany(updateData.managerId, companyId);
    }

    // Validate new members if being updated
    if (updateData.memberIds) {
      await this.validateTeamMembersCompany(updateData.memberIds, companyId);

      // Ensure manager is not in member list
      const managerId = updateData.managerId || team.owner_user_id;
      if (updateData.memberIds.includes(managerId)) {
        throw new BadRequestException(
          'Team manager cannot also be listed as a regular team member'
        );
      }
    }

    // Validate LEGAL team lawyer requirement if category is being set or members are changing
    if (updateData.category === TeamCategory.LEGAL || updateData.memberIds) {
      await this.validateLegalTeamLawyerRequirement(teamId, updateData.category);
    }
  }

  /**
   * Validates team name uniqueness within a company
   */
  private async validateTeamNameUniqueness(
    companyId: string,
    teamName: string,
    excludeTeamId?: string
  ): Promise<void> {
    const whereClause: any = {
      company_id: companyId,
      name: teamName,
    };

    if (excludeTeamId) {
      whereClause.id = { [require('sequelize').Op.ne]: excludeTeamId };
    }

    const existingTeam = await this.teamModel.findOne({
      where: whereClause,
    });

    if (existingTeam) {
      throw new BadRequestException(
        `A team with the name "${teamName}" already exists in this company`
      );
    }
  }

  /**
   * Validates team membership changes with transaction support
   */
  async validateTeamMembershipChanges(
    teamId: string,
    addMemberIds: string[] = [],
    removeMemberIds: string[] = [],
    category?: TeamCategory
  ): Promise<void> {
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

    // Validate new members belong to same company
    if (addMemberIds.length > 0) {
      await this.validateTeamMembersCompany(addMemberIds, team.company_id);

      // Ensure manager is not being added as regular member
      if (addMemberIds.includes(team.owner_user_id)) {
        throw new BadRequestException('Team manager cannot be added as a regular team member');
      }
    }

    // For LEGAL teams, ensure we still have a lawyer after removals
    if (category === TeamCategory.LEGAL && removeMemberIds.length > 0) {
      // Get current members
      const currentMembers = await this.userModel.findAll({
        include: [
          {
            model: Team,
            as: 'teams',
            where: { id: teamId },
            through: { attributes: [] },
          },
        ],
        attributes: ['id', 'is_lawyer'],
      });

      // Get manager
      const manager = await this.userModel.findByPk(team.owner_user_id, {
        attributes: ['id', 'is_lawyer'],
      });

      // Calculate remaining lawyers after removals
      const remainingLawyers = currentMembers.filter(
        (member) => !removeMemberIds.includes(member.id) && member.is_lawyer
      ).length;

      const managerIsLawyer = manager?.is_lawyer || false;

      if (!managerIsLawyer && remainingLawyers === 0) {
        throw new BadRequestException(
          'Cannot remove all lawyers from a LEGAL team. At least one lawyer must remain'
        );
      }
    }
  }

  /**
   * Validates manager change with business rules
   */
  async validateManagerChange(teamId: string, newManagerId: string): Promise<void> {
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

    // Validate new manager belongs to same company
    await this.validateTeamOwnerCompany(newManagerId, team.company_id);

    // Check if new manager is currently a regular member and remove them
    const existingMembership = await this.teamMemberModel.findOne({
      where: {
        team_id: teamId,
        user_id: newManagerId,
      },
    });

    if (existingMembership) {
      throw new BadRequestException(
        'The new manager is currently a regular team member. They will be automatically removed from the member list when promoted to manager.'
      );
    }
  }
}
