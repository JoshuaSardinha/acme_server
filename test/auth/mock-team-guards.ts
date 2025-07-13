import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../src/modules/auth/entities/user.entity';

@Injectable()
export class MockTeamAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // In tests, just allow access since we're testing authorization at the controller level
    return true;
  }
}

@Injectable()
export class MockTeamManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user is admin (admins can manage any team)
    const isAdmin = [UserRole.VENDOR_ADMIN, UserRole.ACME_ADMIN].includes(user.role);
    if (isAdmin) {
      return true;
    }

    // For non-admins, they should not be able to manage teams (in our test scenario)
    throw new ForbiddenException('User must be team manager or company admin');
  }
}

@Injectable()
export class MockCompanyAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user is admin
    const isAdmin = [UserRole.VENDOR_ADMIN, UserRole.ACME_ADMIN].includes(user.role);
    if (!isAdmin) {
      throw new ForbiddenException('User is not an admin');
    }

    // For endpoints with company ID parameter, validate access to that specific company
    const { id: companyId } = request.params;
    if (companyId && user.company_id !== companyId) {
      throw new ForbiddenException('User not authorized to access this company');
    }

    return true;
  }
}
