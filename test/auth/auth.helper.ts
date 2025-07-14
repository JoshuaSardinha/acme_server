import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';

// Load test keys
const privateKey = fs.readFileSync(path.join(__dirname, '../fixtures/private.key'), 'utf8');
export const publicKey = fs.readFileSync(path.join(__dirname, '../fixtures/public.key'), 'utf8');

export interface TestJwtPayload {
  sub: string; // User ID
  permissions?: string[];
  org_id?: string; // Company/Tenant ID
  email?: string;
  role?: string;
  // Add any other custom claims your app uses
}

export class AuthHelper {
  generateToken(payload: TestJwtPayload, options: { expiresIn?: string } = {}): string {
    const fullPayload = {
      // Add issuer (iss) and audience (aud) to match real Auth0 config
      iss: 'https://test-domain.auth0.com/',
      aud: 'acme-api',
      iat: Math.floor(Date.now() / 1000),
      ...payload,
    };

    return jwt.sign(fullPayload, privateKey, {
      algorithm: 'RS256',
      expiresIn: options.expiresIn || '1h',
    });
  }

  generateExpiredToken(payload: TestJwtPayload): string {
    return this.generateToken(payload, { expiresIn: '-1h' });
  }

  generateInvalidToken(): string {
    // Use a different key to make token invalid
    const invalidKey = 'invalid-key';
    return jwt.sign({ sub: 'test' }, invalidKey, { algorithm: 'HS256' });
  }
}

export const authHelper = new AuthHelper();
