import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from '../../modules/role/permissions.service';

/**
 * Bypassable Guard
 *
 * This guard combines super admin bypass logic with normal permission checking.
 * Super admins can bypass all permission requirements, while regular users
 * go through normal permission validation.
 *
 * This provides a clean way to handle super admin privileges without
 * modifying the core PermissionsGuard logic.
 *
 * @example
 * ```typescript
 * @Controller('protected')
 * @UseGuards(JwtAuthGuard, BypassableGuard)
 * @RequirePermissions('SOME_PERMISSION')
 * export class ProtectedController {
 *   // Super admins bypass SOME_PERMISSION requirement
 *   // Regular users still need SOME_PERMISSION
 * }
 * ```
 */
@Injectable()
export class BypassableGuard implements CanActivate {
  private readonly logger = new Logger(BypassableGuard.name);

  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly permissionsGuard: PermissionsGuard
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      // Let authentication guard handle missing user
      return this.permissionsGuard.canActivate(context);
    }

    try {
      // Check if user is a super admin using the new role-based system
      const isSuperAdmin = await this.permissionsService.isSuperAdmin(user.id, user.company_id);

      if (isSuperAdmin) {
        this.logger.debug(
          `Super admin detected for user ${user.id} - bypassing all permission checks`
        );
        return true;
      }

      // Not a super admin - use normal permission checking
      this.logger.debug(
        `User ${user.id} is not a super admin - proceeding with normal permission checks`
      );
      return this.permissionsGuard.canActivate(context);
    } catch (error) {
      this.logger.warn(`Error checking super admin status for user ${user.id}: ${error.message}`);
      // On error checking super admin status, fall back to normal permission checks
      return this.permissionsGuard.canActivate(context);
    }
  }
}
