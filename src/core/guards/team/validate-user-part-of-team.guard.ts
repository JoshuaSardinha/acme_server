import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Team } from '../../../modules/team/entities/team.entity';
import { TeamMember } from '../../../modules/team/entities/team-member.entity';
import { User } from '../../../modules/auth/entities/user.entity';
import { UserIsNotInThisTeamException } from '../../exceptions/team-validation.exceptions';

/**
 * Guard that validates if a user is part of a specific team
 * Equivalent to Express middleware: validateIsUserPartOfTeam
 */
@Injectable()
export class ValidateUserPartOfTeamGuard implements CanActivate {
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

    // Check if user is part of the team (equivalent to getTeamByUserIdAndTeamId)
    const userTeam = await this.teamModel.findOne({
      where: { id: teamId },
      include: [
        {
          model: User,
          as: 'members',
          through: {
            where: { user_id: user.id },
            attributes: [],
          },
          attributes: ['id'],
          required: true,
        },
      ],
    });

    if (!userTeam) {
      throw new UserIsNotInThisTeamException();
    }

    return true;
  }
}
