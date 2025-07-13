import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../../../modules/auth/entities/user.entity';
import { UserNotAdminException } from '../../exceptions/team-validation.exceptions';

/**
 * Guard that validates if a user is admin of the company
 * Equivalent to Express middleware: validateIsUserAdminOfCompany
 */
@Injectable()
export class ValidateUserAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user has admin role
    if (![UserRole.VENDOR_ADMIN, UserRole.ACME_ADMIN].includes(user.role)) {
      throw new UserNotAdminException();
    }

    return true;
  }
}
