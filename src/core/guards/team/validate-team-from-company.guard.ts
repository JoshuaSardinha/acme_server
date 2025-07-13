import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Team } from '../../../modules/team/entities/team.entity';
import { TeamDoesNotBelongToCompanyException } from '../../exceptions/team-validation.exceptions';

/**
 * Guard that validates if a team belongs to the user's company
 * Equivalent to Express middleware: validateIsTeamFromCompany
 */
@Injectable()
export class ValidateTeamFromCompanyGuard implements CanActivate {
  constructor(
    @InjectModel(Team)
    private teamModel: typeof Team
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { teamId } = request.params;

    // Get team by ID
    const team = await this.teamModel.findByPk(teamId);

    // Check if team belongs to user's company
    const belongsToCompany = team?.company_id === user.company_id;

    if (!belongsToCompany) {
      throw new TeamDoesNotBelongToCompanyException();
    }

    return true;
  }
}
