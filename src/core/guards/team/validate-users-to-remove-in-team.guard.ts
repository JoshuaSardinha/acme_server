import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TeamMember } from '../../../modules/team/entities/team-member.entity';
import { User } from '../../../modules/auth/entities/user.entity';
import { Op } from 'sequelize';
import {
  UserToBeRemovedDoesNotExistException,
  UserToBeRemovedDoesNotBelongToCompanyException,
  UserIsNotInThisTeamException,
} from '../../exceptions/team-validation.exceptions';

/**
 * Guard that validates if multiple users to be removed are actually in the team
 * Equivalent to Express middleware: validateUsersToBeRemovedAreInThisTeam
 */
@Injectable()
export class ValidateUsersToRemoveInTeamGuard implements CanActivate {
  constructor(
    @InjectModel(TeamMember)
    private teamMemberModel: typeof TeamMember,
    @InjectModel(User)
    private userModel: typeof User
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { teamId } = request.params;
    const userIds = request.body.userIds;

    // Find all users to be removed
    const usersToBeRemoved = await Promise.all(
      userIds.map((id: string) => this.userModel.findByPk(id))
    );

    // Check if all users exist
    if (usersToBeRemoved.some((user) => !user)) {
      throw new UserToBeRemovedDoesNotExistException();
    }

    // Check if all users belong to the same company
    if (usersToBeRemoved.some((u) => u?.company_id !== user.company_id)) {
      throw new UserToBeRemovedDoesNotBelongToCompanyException();
    }

    // Check if all users are in the team
    const teamMembers = await this.teamMemberModel.findAll({
      where: {
        team_id: teamId,
        user_id: { [Op.in]: userIds },
      },
    });

    if (teamMembers.length !== userIds.length) {
      throw new UserIsNotInThisTeamException();
    }

    // Attach validated users to request for use in controllers
    request.usersToBeRemoved = usersToBeRemoved;

    return true;
  }
}
