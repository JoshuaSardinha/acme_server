import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom parameter decorator to extract the current authenticated user from the request
 *
 * This decorator should be used in controllers where you need access to the currently
 * authenticated user. It extracts the user object that was attached to the request
 * by the JWT authentication guard.
 *
 * @example
 * ```typescript
 * @Post()
 * async createTeam(
 *   @Body() createTeamDto: CreateTeamDto,
 *   @CurrentUser() user: any,
 * ) {
 *   // user object contains the authenticated user's information
 *   console.log(user.id, user.email);
 * }
 * ```
 *
 * @remarks
 * - This decorator requires that the route is protected by JwtAuthGuard
 * - The user object structure depends on what the JWT strategy attaches to req.user
 * - Returns the entire user object from req.user
 */
export const CurrentUser = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;

  // If a specific property is requested, return just that property
  return data ? user?.[data] : user;
});
