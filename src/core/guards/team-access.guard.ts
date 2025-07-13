import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Team } from '../../modules/team/entities/team.entity';
import { TeamMember } from '../../modules/team/entities/team-member.entity';
import { UserRole } from '../../modules/auth/entities/user.entity';

@Injectable()
export class TeamAccessGuard implements CanActivate {
  constructor(
    @InjectModel(Team)
    private teamModel: typeof Team,
    @InjectModel(TeamMember)
    private teamMemberModel: typeof TeamMember
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { teamId } = request.params;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!teamId) {
      throw new ForbiddenException('Team ID is required');
    }

    // Find the team
    const team = await this.teamModel.findByPk(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Check if user belongs to the same company as the team
    if (user.company_id !== team.company_id) {
      throw new ForbiddenException('User not authorized to access this team');
    }

    // Check if user is team member, manager, or company admin
    const isCompanyAdmin = [UserRole.VENDOR_ADMIN, UserRole.ACME_ADMIN].includes(user.role);
    const isTeamManager = team.owner_user_id === user.id;

    let isTeamMember = false;
    if (!isCompanyAdmin && !isTeamManager) {
      const teamMembership = await this.teamMemberModel.findOne({
        where: {
          team_id: teamId,
          user_id: user.id,
        },
      });
      isTeamMember = !!teamMembership;
    }

    if (!isCompanyAdmin && !isTeamManager && !isTeamMember) {
      throw new ForbiddenException('User not authorized to access this team');
    }

    // Attach team to request for use in controllers
    request.team = team;

    return true;
  }
}

@Injectable()
export class TeamManagerGuard implements CanActivate {
  constructor(
    @InjectModel(Team)
    private teamModel: typeof Team
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { teamId } = request.params;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!teamId) {
      throw new ForbiddenException('Team ID is required');
    }

    // Find the team
    const team = await this.teamModel.findByPk(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Check if user belongs to the same company as the team
    if (user.company_id !== team.company_id) {
      throw new ForbiddenException('User not authorized to access this team');
    }

    // Check if user is team manager or company admin
    const isCompanyAdmin = [UserRole.VENDOR_ADMIN, UserRole.ACME_ADMIN].includes(user.role);
    const isTeamManager = team.owner_user_id === user.id;

    if (!isCompanyAdmin && !isTeamManager) {
      throw new ForbiddenException('User must be team manager or company admin');
    }

    // Attach team to request for use in controllers
    request.team = team;

    return true;
  }
}
