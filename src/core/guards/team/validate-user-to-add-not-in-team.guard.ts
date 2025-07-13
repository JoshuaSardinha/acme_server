import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Team } from '../../../modules/team/entities/team.entity';
import { TeamMember } from '../../../modules/team/entities/team-member.entity';
import { User } from '../../../modules/auth/entities/user.entity';
import {
  UserToBeAddedDoesNotExistException,
  UserToBeAddedDoesNotBelongToCompanyException,
  UserIsAlreadyInTeamException,
} from '../../exceptions/team-validation.exceptions';

/**
 * Guard that validates if a user to be added is not already in the team
 * Equivalent to Express middleware: validateUserToBeAddedIsNotInThisTeam
 */
@Injectable()
export class ValidateUserToAddNotInTeamGuard implements CanActivate {
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
    const userToBeAddedId = request.body.userId;

    // Find the user to be added
    const userToBeAdded = await this.userModel.findByPk(userToBeAddedId);

    if (!userToBeAdded) {
      throw new UserToBeAddedDoesNotExistException();
    }

    // Check if user to be added belongs to the same company
    if (userToBeAdded.company_id !== user.company_id) {
      throw new UserToBeAddedDoesNotBelongToCompanyException();
    }

    // Attach validated user to request for use in controllers
    request.userToBeAdded = userToBeAdded;

    // Check if user is already in the team (equivalent to getTeamByUserIdAndTeamId)
    const userTeam = await this.teamModel.findOne({
      where: { id: teamId },
      include: [
        {
          model: User,
          as: 'members',
          through: {
            where: { user_id: userToBeAdded.id },
            attributes: [],
          },
          attributes: ['id'],
          required: true,
        },
      ],
    });

    if (userTeam) {
      throw new UserIsAlreadyInTeamException();
    }

    return true;
  }
}
