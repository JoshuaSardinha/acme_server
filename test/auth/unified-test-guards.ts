import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Reflector } from '@nestjs/core';
import { UserRole, User } from '../../src/modules/auth/entities/user.entity';
import * as jwt from 'jsonwebtoken';
import { publicKey } from './auth.helper';
import { REQUIRE_PERMISSIONS_KEY } from '../../src/core/guards/permissions.guard';

/**
 * Unified Mock Guards for E2E Testing
 *
 * This file provides consistent mock implementations for all guards used across modules.
 * All guards implement proper authorization logic for test scenarios while ensuring
 * proper test isolation and consistent behavior.
 */

@Injectable()
export class UnifiedMockJwtAuthGuard implements CanActivate {
  constructor(
    @InjectModel(User)
    private userModel: typeof User
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        success: false,
        code: 'AUTHORIZATION_MISSING_TOKEN',
        message: 'Authorization token required',
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      // Use our test public key instead of Auth0
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
      });

      // Attach decoded token to request
      request.userDecoded = decoded;

      // Get the authenticated user from database using sub field
      const user = await this.userModel.findOne({
        where: { auth0_user_id: (decoded as any).sub },
      });

      if (!user) {
        throw new UnauthorizedException({
          success: false,
          code: 'AUTH_USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      request.user = user;
      return true;
    } catch (error) {
      // Re-throw known UnauthorizedException errors (like AUTH_USER_NOT_FOUND) as-is
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          success: false,
          code: 'AUTHORIZATION_INVALID_TOKEN',
          message: 'Invalid authorization token.',
        });
      }

      throw new UnauthorizedException({
        success: false,
        code: 'AUTHORIZATION_SERVER_ERROR',
        message: 'Internal server error during token validation.',
      });
    }
  }
}

@Injectable()
export class UnifiedMockCompanyAdminGuard implements CanActivate {
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
    if (companyId) {
      // Convert to string for comparison (company IDs are UUIDs, not integers)
      const requestedCompanyId = companyId;

      // Check if user belongs to the requested company
      if (user.company_id !== requestedCompanyId) {
        throw new ForbiddenException('User not authorized to access this company');
      }
    }

    return true;
  }
}

@Injectable()
export class UnifiedMockTeamAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // In tests, we'll allow access if user is authenticated
    // Additional team-specific access control is handled in the controller/service layer
    return true;
  }
}

@Injectable()
export class UnifiedMockTeamManagerGuard implements CanActivate {
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
export class UnifiedMockRolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Basic role-based access - admins can access role endpoints
    const isAdmin = [UserRole.VENDOR_ADMIN, UserRole.ACME_ADMIN].includes(user.role);

    return isAdmin;
  }
}

@Injectable()
export class UnifiedMockPermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user is set by JwtAuthGuard, deny access
    if (!user) {
      throw new ForbiddenException({
        success: false,
        code: 'PERMISSION_DENIED',
        message: 'User not authenticated',
      });
    }

    // Get required permissions from metadata
    const requiredPermissions = this.reflector.getAllAndMerge<string[]>(REQUIRE_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // For testing purposes, we'll use a simplified permission check
    // Admin users have all permissions
    const isAdmin = [UserRole.VENDOR_ADMIN, UserRole.ACME_ADMIN].includes(user.role);

    if (isAdmin) {
      return true;
    }

    // For non-admin users, we'll deny access to simulate permission checking
    // In a real test, you would check against actual user permissions
    throw new ForbiddenException({
      success: false,
      code: 'PERMISSION_DENIED',
      message: 'Insufficient permissions',
    });
  }
}

/**
 * Export all guards with their original names for easy replacement
 */
export {
  UnifiedMockJwtAuthGuard as MockJwtAuthGuard,
  UnifiedMockCompanyAdminGuard as MockCompanyAdminGuard,
  UnifiedMockTeamAccessGuard as MockTeamAccessGuard,
  UnifiedMockTeamManagerGuard as MockTeamManagerGuard,
  UnifiedMockRolesGuard as MockRolesGuard,
  UnifiedMockPermissionsGuard as MockPermissionsGuard,
};
