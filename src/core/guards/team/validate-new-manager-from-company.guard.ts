import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Team } from '../../../modules/team/entities/team.entity';
import { User } from '../../../modules/auth/entities/user.entity';
import {
  UserNotFoundValidationException,
  UserNotFromCompanyException,
} from '../../exceptions/team-validation.exceptions';

/**
 * Guard that validates if a new manager belongs to the same company as the team
 * Equivalent to Express middleware: validateNewManagerIsFromCompany
 */
@Injectable()
export class ValidateNewManagerFromCompanyGuard implements CanActivate {
  constructor(
    @InjectModel(Team)
    private teamModel: typeof Team,
    @InjectModel(User)
    private userModel: typeof User
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { userId } = request.body;
    const { teamId } = request.params;

    // Get team details
    const team = await this.teamModel.findByPk(teamId);

    // Find the new manager
    const newManager = await this.userModel.findByPk(userId);

    if (!newManager) {
      throw new UserNotFoundValidationException();
    }

    // Check if new manager belongs to the same company as the team
    if (newManager.company_id !== team?.company_id) {
      throw new UserNotFromCompanyException();
    }

    // Attach validated data to request for use in controllers
    request.newManager = newManager;
    request.team = team;

    return true;
  }
}
