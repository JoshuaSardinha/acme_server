import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TeamMember } from '../../../modules/team/entities/team-member.entity';
import { User } from '../../../modules/auth/entities/user.entity';
import { Op } from 'sequelize';
import {
  UserToBeAddedDoesNotExistException,
  UserToBeAddedDoesNotBelongToCompanyException,
  UserIsAlreadyInTeamException,
} from '../../exceptions/team-validation.exceptions';

/**
 * Guard that validates if multiple users to be added are not already in the team
 * Equivalent to Express middleware: validateUsersToBeAddedAreNotInThisTeam
 */
@Injectable()
export class ValidateUsersToAddNotInTeamGuard implements CanActivate {
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

    // Find all users to be added
    const usersToBeAdded = await Promise.all(
      userIds.map((id: string) => this.userModel.findByPk(id))
    );

    // Check if all users exist
    if (usersToBeAdded.some((user) => !user)) {
      throw new UserToBeAddedDoesNotExistException();
    }

    // Check if all users belong to the same company
    if (usersToBeAdded.some((u) => u?.company_id !== user.company_id)) {
      throw new UserToBeAddedDoesNotBelongToCompanyException();
    }

    // Check if any user is already in the team
    const existingMembers = await this.teamMemberModel.findAll({
      where: {
        team_id: teamId,
        user_id: { [Op.in]: userIds },
      },
    });

    if (existingMembers.length > 0) {
      throw new UserIsAlreadyInTeamException();
    }

    // Attach validated users to request for use in controllers
    request.usersToBeAdded = usersToBeAdded;

    return true;
  }
}
