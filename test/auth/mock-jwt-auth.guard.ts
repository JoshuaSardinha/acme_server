import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../../src/modules/auth/entities/user.entity';
import { publicKey } from './auth.helper';

@Injectable()
export class MockJwtAuthGuard implements CanActivate {
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
        code: 'AUTHORIZATION_HEADER_INVALID',
        message: 'Authorization header is invalid.',
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
        include: [{ association: 'role' }],
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
      // Re-throw UnauthorizedException to preserve specific error codes
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
