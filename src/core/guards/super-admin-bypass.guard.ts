import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { PermissionsService } from '../../modules/role/permissions.service';

/**
 * Super Admin Bypass Guard
 *
 * This guard allows super admins to bypass all permission checks.
 * It should be used in combination with other guards in a specific order:
 *
 * 1. JwtAuthGuard (authentication)
 * 2. SuperAdminBypassGuard (this guard)
 * 3. PermissionsGuard (permission checking)
 *
 * If a user has SUPER_ADMIN role or 'super_admin.bypass_company_restrictions' permission,
 * this guard allows access and short-circuits further guard execution.
 *
 * @example
 * ```typescript
 * @Controller('protected')
 * @UseGuards(JwtAuthGuard, SuperAdminBypassGuard, PermissionsGuard)
 * @RequirePermissions('SOME_PERMISSION')
 * export class ProtectedController {
 *   // Super admins bypass SOME_PERMISSION requirement
 *   // Regular users still need SOME_PERMISSION
 * }
 * ```
 */
@Injectable()
export class SuperAdminBypassGuard implements CanActivate {
  private readonly logger = new Logger(SuperAdminBypassGuard.name);

  constructor(private readonly permissionsService: PermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      // Let authentication guard handle missing user
      return true;
    }

    try {
      // Check if user is a super admin using the new role-based system
      const isSuperAdmin = await this.permissionsService.isSuperAdmin(user.id, user.company_id);

      if (isSuperAdmin) {
        this.logger.debug(`Super admin detected for user ${user.id} - bypassing permission checks`);
        // Set flag to indicate super admin bypass for downstream guards
        request.superAdminBypass = true;
        return true;
      }

      // Not a super admin - continue to next guard
      this.logger.debug(`User ${user.id} is not a super admin - continuing to permission checks`);
      return true;
    } catch (error) {
      this.logger.warn(`Error checking super admin status for user ${user.id}: ${error.message}`);
      // On error, continue to normal permission checks rather than failing
      return true;
    }
  }
}
