import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './jwt-payload.interface';

/**
 * JWT Strategy for Auth0 token validation
 *
 * This strategy implements secure JWT validation using Auth0's JWKS endpoint
 * for dynamic key fetching with caching and rate limiting.
 *
 * Security features:
 * - Dynamic JWKS key fetching (replaces manual getKey from Express)
 * - Audience validation prevents token reuse across APIs
 * - Issuer validation prevents tokens from unauthorized sources
 * - Algorithm specification prevents downgrade attacks
 * - Expiration validation prevents replay attacks
 * - JWKS caching and rate limiting for performance
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const issuerURL = configService.get<string>('AUTH0_ISSUER_BASE_URL');
    const audience = configService.get<string>('AUTH0_AUDIENCE');

    // Validate required configuration at startup
    if (!issuerURL) {
      throw new Error('AUTH0_ISSUER_BASE_URL is required for JWT strategy');
    }
    if (!audience) {
      throw new Error('AUTH0_AUDIENCE is required for JWT strategy');
    }

    super({
      // CRITICAL: Dynamic JWKS key fetching with enhanced security
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        cacheMaxEntries: 5, // Maximum number of keys to cache
        cacheMaxAge: 10 * 60 * 60 * 1000, // 10 hours in milliseconds
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${issuerURL}/.well-known/jwks.json`,
      }),

      // Extract JWT from Authorization: Bearer header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // CRITICAL: Security validation options
      audience: audience,
      issuer: `${issuerURL}/`,
      algorithms: ['RS256'], // Explicit algorithm specification prevents attacks
      ignoreExpiration: false, // Ensure expired tokens are rejected
    });
  }

  /**
   * Validates the JWT payload after successful signature and claims verification
   *
   * This method is called by the Passport framework after a token has been
   * successfully validated against the JWKS. The token's signature and
   * standard claims (exp, nbf, iss, aud) have already been verified.
   *
   * The returned value is attached to the `Request` object as `req.user`.
   *
   * @param payload The decoded and validated JWT payload
   * @returns The user object or payload to be attached to the request
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // At this point, the token is guaranteed to be valid according to the options
    // in the constructor. We can trust the contents of the payload.

    // Additional business logic can be added here, such as:
    // - Database lookup to enrich user object
    // - Check if user is active/enabled
    // - Validate custom claims or permissions

    // For a stateless API, returning the payload is often sufficient
    // The downstream application can access user ID via req.user.sub
    return payload;
  }
}
