import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Company } from '../entities/company.entity';
import { User } from '../../auth/entities/user.entity';
import { Team } from '../../team/entities/team.entity';

@Injectable()
export class CompanyValidationService {
  constructor(
    @InjectModel(Company)
    private companyModel: typeof Company,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Team)
    private teamModel: typeof Team
  ) {}

  /**
   * Validates that a user belongs to a specific company
   */
  async validateUserBelongsToCompany(userId: string, companyId: string): Promise<void> {
    const user = await this.userModel.findByPk(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.company_id !== companyId) {
      throw new BadRequestException(
        `User ${userId} does not belong to company ${companyId}. User belongs to company ${user.company_id || 'none'}`
      );
    }
  }

  /**
   * Validates that multiple users belong to the same company
   */
  async validateUsersBelongToCompany(userIds: string[], companyId: string): Promise<void> {
    const users = await this.userModel.findAll({
      where: { id: userIds },
      attributes: ['id', 'company_id'],
    });

    if (users.length !== userIds.length) {
      const foundUserIds = users.map((u) => u.id);
      const missingUserIds = userIds.filter((id) => !foundUserIds.includes(id));
      throw new NotFoundException(`Users not found: ${missingUserIds.join(', ')}`);
    }

    const invalidUsers = users.filter((user) => user.company_id !== companyId);
    if (invalidUsers.length > 0) {
      const invalidUserInfo = invalidUsers
        .map((u) => `${u.id} (belongs to company ${u.company_id || 'none'})`)
        .join(', ');
      throw new BadRequestException(
        `The following users do not belong to company ${companyId}: ${invalidUserInfo}`
      );
    }
  }

  /**
   * Validates that a company exists
   */
  async validateCompanyExists(companyId: string): Promise<Company> {
    const company = await this.companyModel.findByPk(companyId);
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }
    return company;
  }

  /**
   * Validates that a user has permission to manage a company
   */
  async validateUserCanManageCompany(userId: string, companyId: string): Promise<void> {
    const user = await this.userModel.findByPk(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const company = await this.companyModel.findByPk(companyId);
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    // User must be the company owner or belong to the company with admin/manager role
    const isOwner = company.owner_id === userId;
    const isCompanyMember = user.company_id === companyId;
    const hasManagementRole = [
      'Vendor Admin',
      'Vendor Manager',
      'Acme Admin',
      'Acme Manager',
    ].includes(user.role?.name || '');

    if (!isOwner && !(isCompanyMember && hasManagementRole)) {
      throw new BadRequestException('User does not have permission to manage this company');
    }
  }

  /**
   * Validates team name uniqueness within a company
   */
  async validateTeamNameUniqueness(
    companyId: string,
    teamName: string,
    excludeTeamId?: string
  ): Promise<void> {
    const whereClause: any = {
      company_id: companyId,
      name: teamName,
    };

    if (excludeTeamId) {
      whereClause.id = { [Op.ne]: excludeTeamId };
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
   * Validates cross-company relationships to prevent data leakage
   */
  async validateCrossCompanyAccess(
    requestingUserId: string,
    targetCompanyId: string
  ): Promise<void> {
    const requestingUser = await this.userModel.findByPk(requestingUserId);
    if (!requestingUser) {
      throw new NotFoundException(`Requesting user with ID ${requestingUserId} not found`);
    }

    // Allow Acme employees to access any company
    if (
      ['Acme Admin', 'Acme Manager', 'Acme Employee'].includes(
        requestingUser.role?.name || ''
      )
    ) {
      return;
    }

    // For vendor users, they can only access their own company
    if (requestingUser.company_id !== targetCompanyId) {
      throw new BadRequestException('Access denied: Cannot access data from a different company');
    }
  }
}
