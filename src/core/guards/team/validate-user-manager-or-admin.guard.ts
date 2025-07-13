import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Team } from '../../../modules/team/entities/team.entity';
import { UserRole } from '../../../modules/auth/entities/user.entity';
import { UserIsNotAdminOrManagerException } from '../../exceptions/team-validation.exceptions';

/**
 * Guard that validates if a user is manager of a team or admin of the company
 * Equivalent to Express middleware: validateIsUserManagerOfTeamOrAdminOfCompany
 */
@Injectable()
export class ValidateUserManagerOrAdminGuard implements CanActivate {
  constructor(
    @InjectModel(Team)
    private teamModel: typeof Team
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { teamId } = request.params;

    // Check if user has manager or admin role
    const isManager = [UserRole.VENDOR_MANAGER, UserRole.ACME_MANAGER].includes(user.role);
    const isAdmin = [UserRole.VENDOR_ADMIN, UserRole.ACME_ADMIN].includes(user.role);

    // Get team details
    const team = await this.teamModel.findByPk(teamId);

    // Check if user is admin or manager of this specific team
    const isAdminOrManager = isAdmin || (isManager && team?.owner_user_id === user.id);

    if (!isAdminOrManager) {
      throw new UserIsNotAdminOrManagerException();
    }

    return true;
  }
}
