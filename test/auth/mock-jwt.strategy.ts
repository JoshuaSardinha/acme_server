import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { publicKey } from './auth.helper';

@Injectable()
export class MockJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    // The payload is already validated by passport-jwt
    // Attach it to the request object for use in guards
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: payload.org_id,
      permissions: payload.permissions || [],
      ...payload,
    };
  }
}
