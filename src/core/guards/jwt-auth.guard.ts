import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { InjectModel } from '@nestjs/sequelize';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { User } from '../../modules/auth/entities/user.entity';
import { JwtPayload } from '../../modules/auth/jwt-payload.interface';
import { Role } from '../../modules/role/entities/role.entity';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT Authentication Guard
 *
 * This guard extends the standard PassportJS AuthGuard to:
 * 1. Handle public routes (marked with @Public decorator)
 * 2. Validate JWT tokens using the passport JWT strategy
 * 3. Lookup and attach the user entity from the database
 *
 * The underlying JWT validation (signature, expiration, audience, issuer)
 * is handled by the JwtStrategy using Auth0's JWKS endpoint.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @InjectModel(User)
    private userModel: typeof User
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the endpoint is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    try {
      // Call the parent canActivate which runs the JWT strategy validation
      const canActivate = await super.canActivate(context);

      if (!canActivate) {
        return false;
      }
    } catch (error) {
      // Log the specific error for debugging
      console.error('JWT validation error in canActivate:', error);

      // Check if it's a configuration error
      if (
        error.message &&
        (error.message.includes('AUTH0_ISSUER_BASE_URL') ||
          error.message.includes('AUTH0_AUDIENCE'))
      ) {
        throw new UnauthorizedException({
          success: false,
          code: 'AUTH_CONFIG_ERROR',
          message:
            'Authentication service is not properly configured. Please check Auth0 settings.',
        });
      }

      // Re-throw the original error if it's already an UnauthorizedException
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Otherwise, throw a generic authentication error
      throw new UnauthorizedException({
        success: false,
        code: 'AUTHORIZATION_INVALID_TOKEN',
        message: 'Invalid authorization token.',
      });
    }

    // At this point, JWT validation has passed and req.user contains the JWT payload
    const request = context.switchToHttp().getRequest();
    const jwtPayload: JwtPayload = request.user;

    try {
      // Get the authenticated user from database using Auth0 user ID
      const user = await this.userModel.findOne({
        where: { auth0_user_id: jwtPayload.sub },
        include: [
          {
            model: Role,
            attributes: ['id', 'name', 'code'],
            required: true,
          },
        ],
      });

      if (!user) {
        throw new UnauthorizedException({
          success: false,
          code: ERROR_CODES.AUTH_USER_NOT_FOUND,
          message: 'User not found',
        });
      }

      // Attach both JWT payload and user entity to request
      request.userDecoded = jwtPayload;
      request.user = user;

      return true;
    } catch (error) {
      console.error('User lookup error:', error);

      // Re-throw UnauthorizedException to preserve specific error codes
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // For any other database errors, return a generic unauthorized response
      throw new UnauthorizedException({
        success: false,
        code: 'AUTHORIZATION_INVALID_TOKEN',
        message: 'Invalid authorization token.',
      });
    }
  }

  /**
   * Handle authentication errors from the JWT strategy
   * Provides consistent error responses for all JWT validation failures
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Log detailed error information for debugging
    if (err || !user) {
      console.error('JWT handleRequest error:', {
        error: err?.message || err,
        info: info?.message || info,
        hasUser: !!user,
      });
    }

    // Handle specific error cases
    if (err) {
      // Configuration errors
      if (
        err.message &&
        (err.message.includes('AUTH0_ISSUER_BASE_URL') || err.message.includes('AUTH0_AUDIENCE'))
      ) {
        throw new UnauthorizedException({
          success: false,
          code: 'AUTH_CONFIG_ERROR',
          message:
            'Authentication service is not properly configured. Please check Auth0 settings.',
        });
      }

      // JWT specific errors
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired.',
        });
      }

      if (err.name === 'JsonWebTokenError') {
        throw new UnauthorizedException({
          success: false,
          code: 'INVALID_TOKEN',
          message: 'Token is malformed or invalid.',
        });
      }

      // Re-throw if already UnauthorizedException
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      // Generic error
      throw new UnauthorizedException({
        success: false,
        code: 'AUTHORIZATION_INVALID_TOKEN',
        message: 'Invalid authorization token.',
      });
    }

    // No user returned from strategy (shouldn't happen if strategy is working correctly)
    if (!user) {
      console.error('No user returned from JWT strategy');
      throw new UnauthorizedException({
        success: false,
        code: 'AUTHORIZATION_INVALID_TOKEN',
        message: 'Invalid authorization token.',
      });
    }

    return user;
  }
}
