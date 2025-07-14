import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './jwt-payload.interface';

/**
 * Mock JWT strategy for testing purposes
 *
 * This strategy provides safe defaults for Auth0 configuration and bypasses
 * real JWT validation by returning a static mock user. It extends the same
 * passport-jwt Strategy as the real JwtStrategy but with test-safe configuration.
 *
 * Features:
 * - Uses safe mock Auth0 configuration (no external dependencies)
 * - Returns consistent mock user data for predictable testing
 * - Implements the same interface as the real JwtStrategy
 * - No network calls or external Auth0 validation
 */
@Injectable()
export class MockJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    // Initialize with safe mock configuration that won't make external calls
    super({
      // Use a static secret instead of JWKS for testing
      secretOrKey: 'mock-test-secret-key',
      // Extract JWT from Authorization header (same as real strategy)
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Mock Auth0 configuration
      audience: 'https://api.test.acme.com',
      issuer: 'https://test-auth0-domain.auth0.com/',
      algorithms: ['RS256'],
      ignoreExpiration: true, // Ignore expiration for testing
    });
  }

  /**
   * Mock validation that always succeeds
   *
   * In the real JWT strategy, this method validates the JWT payload.
   * In this mock version, we simply return a consistent mock user
   * that can be used across all tests.
   *
   * @param payload The JWT payload (will be mock data in tests)
   * @returns Mock JWT payload for testing
   */
  async validate(payload: any): Promise<JwtPayload> {
    // Return a mock user payload that matches the JwtPayload interface
    // This ensures compatibility with existing auth logic in the application
    return {
      iss: 'https://test-auth0-domain.auth0.com/',
      sub: 'mock-user-id-123',
      aud: 'https://api.test.acme.com',
      iat: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      azp: 'mock-client-id',
      scope: 'read:profile write:profile',
    };
  }
}
