import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Team } from '../../../modules/team/entities/team.entity';
import { TeamMember } from '../../../modules/team/entities/team-member.entity';
import { User } from '../../../modules/auth/entities/user.entity';
import {
  UserToBeRemovedDoesNotExistException,
  UserToBeRemovedDoesNotBelongToCompanyException,
  UserIsNotInThisTeamException,
} from '../../exceptions/team-validation.exceptions';

/**
 * Guard that validates if a user to be removed is actually in the team
 * Equivalent to Express middleware: validateUserToBeRemovedIsInThisTeam
 */
@Injectable()
export class ValidateUserToRemoveInTeamGuard implements CanActivate {
  constructor(
    @InjectModel(Team)
    private teamModel: typeof Team,
    @InjectModel(TeamMember)
    private teamMemberModel: typeof TeamMember,
    @InjectModel(User)
    private userModel: typeof User
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { teamId } = request.params;
    const userToBeRemovedId = request.params.userId;

    // Find the user to be removed
    const userToBeRemoved = await this.userModel.findByPk(userToBeRemovedId);

    if (!userToBeRemoved) {
      throw new UserToBeRemovedDoesNotExistException();
    }

    // Check if user to be removed belongs to the same company
    if (userToBeRemoved.company_id !== user.company_id) {
      throw new UserToBeRemovedDoesNotBelongToCompanyException();
    }

    // Attach validated user to request for use in controllers
    request.userToBeRemoved = userToBeRemoved;

    // Check if user is actually in the team (equivalent to getTeamByUserIdAndTeamId)
    const userTeam = await this.teamModel.findOne({
      where: { id: teamId },
      include: [
        {
          model: User,
          as: 'members',
          through: {
            where: { user_id: userToBeRemoved.id },
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
