/**
 * JWT Payload Interface for Auth0 tokens
 *
 * Defines the structure of a validated JWT payload from Auth0,
 * including standard claims and potential custom claims.
 */
export interface JwtPayload {
  /** Issuer (who created and signed this token) */
  iss: string;

  /** Subject (whom the token refers to) - Auth0 user ID */
  sub: string;

  /** Audience (who or what the token is intended for) */
  aud: string | string[];

  /** Issued at (seconds since the Unix epoch) */
  iat: number;

  /** Expiration time (seconds since the Unix epoch) */
  exp: number;

  /** Authorized party - the party to which the ID token was issued */
  azp: string;

  /** Scope (permissions) of the token */
  scope?: string;

  // Custom claims from Auth0 Actions/Rules can be added here
  // Example: 'https://my-app.com/roles'?: string[];
}
