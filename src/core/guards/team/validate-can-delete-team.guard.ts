import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Team } from '../../../modules/team/entities/team.entity';
import { UserRole } from '../../../modules/auth/entities/user.entity';
import {
  TeamNotFoundException,
  UserIsNotTeamManagerOrAdminException,
} from '../../exceptions/team-validation.exceptions';

/**
 * Guard that validates if a user can delete a team
 * Equivalent to Express middleware: validateCanDeleteTeam
 */
@Injectable()
export class ValidateCanDeleteTeamGuard implements CanActivate {
  constructor(
    @InjectModel(Team)
    private teamModel: typeof Team
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { teamId } = request.params;

    // Find the team
    const team = await this.teamModel.findByPk(teamId);

    if (!team) {
      throw new TeamNotFoundException();
    }

    // Check if user is admin or team manager
    const isAdmin = [UserRole.VENDOR_ADMIN, UserRole.ACME_ADMIN].includes(user.role);
    const isTeamManager = team.owner_user_id === user.id;

    if (!isAdmin && !isTeamManager) {
      throw new UserIsNotTeamManagerOrAdminException();
    }

    return true;
  }
}
