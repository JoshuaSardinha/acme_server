import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../../../modules/auth/entities/user.entity';
import {
  InvalidUserIdsException,
  UserNotFoundValidationException,
  UserNotFromCompanyException,
} from '../../exceptions/team-validation.exceptions';

/**
 * Guard that validates if users to be replaced belong to the same company
 * Equivalent to Express middleware: validateUsersToBeReplacedAreFromCompany
 */
@Injectable()
export class ValidateUsersToReplaceFromCompanyGuard implements CanActivate {
  constructor(
    @InjectModel(User)
    private userModel: typeof User
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userIds = request.body.userIds;

    // Validate userIds array
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new InvalidUserIdsException();
    }

    // Find all users to be added
    const usersToBeAdded = await Promise.all(
      userIds.map((id: string) => this.userModel.findByPk(id))
    );

    // Check if all users exist
    if (usersToBeAdded.some((user) => !user)) {
      throw new UserNotFoundValidationException();
    }

    // Check if all users belong to the same company
    if (usersToBeAdded.some((u) => u?.company_id !== user.company_id)) {
      throw new UserNotFromCompanyException();
    }

    // Attach validated users to request for use in controllers
    request.usersToBeAdded = usersToBeAdded;

    return true;
  }
}
