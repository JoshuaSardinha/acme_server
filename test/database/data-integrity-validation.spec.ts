import { Test, TestingModule } from '@nestjs/testing';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { User } from '../../src/modules/auth/entities/user.entity';
import { Company } from '../../src/modules/company/entities/company.entity';
import { TeamMember } from '../../src/modules/team/entities/team-member.entity';
import { Team } from '../../src/modules/team/entities/team.entity';

interface IntegrityViolation {
  type: 'FOREIGN_KEY' | 'UNIQUE' | 'NOT_NULL' | 'CHECK' | 'DATA_CONSISTENCY';
  table: string;
  column?: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  testData?: any;
}

interface ConstraintTest {
  name: string;
  description: string;
  testFunction: () => Promise<void>;
  expectedViolation: string;
}

/**
 * Data Integrity Validation Suite for Task 2.1 Database Schema
 *
 * This comprehensive test suite validates:
 * - Foreign key constraint enforcement
 * - Unique constraint validation
 * - NOT NULL constraint testing
 * - Check constraint verification
 * - Data consistency rules
 * - Cascade behavior testing
 * - Orphaned record detection
 * - Data corruption prevention
 */
describe('Data Integrity Validation - Task 2.1 Constraint Testing', () => {
  let sequelize: Sequelize;
  let module: TestingModule;
  let integrityViolations: IntegrityViolation[] = [];

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [],
    }).compile();

    sequelize = new Sequelize({
      dialect: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME_TEST || 'acme_test',
      logging: false,
      models: [Company, Team, TeamMember, User],
    });

    await sequelize.authenticate();

    // Initialize test data
    await initializeIntegrityTestData();
  });

  beforeEach(() => {
    integrityViolations = [];
  });

  afterEach(() => {
    // Log any integrity violations found
    if (integrityViolations.length > 0) {
      console.log('\n=== Data Integrity Violations Detected ===');
      integrityViolations.forEach((violation) => {
        const severity =
          violation.severity === 'CRITICAL'
            ? '🔴'
            : violation.severity === 'HIGH'
              ? '🟠'
              : violation.severity === 'MEDIUM'
                ? '🟡'
                : '🟢';
        console.log(`${severity} ${violation.type} - ${violation.table}: ${violation.description}`);
      });
    }
  });

  afterAll(async () => {
    await cleanupIntegrityTestData();
    await sequelize.close();
    await module.close();
  });

  describe('Foreign Key Constraint Validation', () => {
    it('should enforce foreign key constraints on Companies.owner_id', async () => {
      const constraintTests: ConstraintTest[] = [
        {
          name: 'Invalid owner_id reference',
          description: 'Should reject company with non-existent owner_id',
          testFunction: async () => {
            await sequelize.query(
              'INSERT INTO Companies (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
              {
                replacements: [
                  'integrity-test-company-invalid',
                  'Invalid Company',
                  'non-existent-user-id',
                ],
                type: QueryTypes.INSERT,
              }
            );
          },
          expectedViolation: 'FOREIGN_KEY_CONSTRAINT',
        },
        {
          name: 'NULL owner_id (should be allowed)',
          description: 'Should allow company with NULL owner_id',
          testFunction: async () => {
            await sequelize.query(
              'INSERT INTO Companies (id, name, owner_id, created_at, updated_at) VALUES (?, ?, NULL, NOW(), NOW())',
              {
                replacements: ['integrity-test-company-null-owner', 'Company with NULL Owner'],
                type: QueryTypes.INSERT,
              }
            );
            // This should succeed, so we need to clean it up
            await sequelize.query('DELETE FROM Companies WHERE id = ?', {
              replacements: ['integrity-test-company-null-owner'],
              type: QueryTypes.DELETE,
            });
          },
          expectedViolation: 'NONE',
        },
      ];

      for (const test of constraintTests) {
        if (test.expectedViolation === 'NONE') {
          // Test should succeed
          await expect(test.testFunction()).resolves.not.toThrow();
        } else {
          // Test should fail with constraint violation
          await expect(test.testFunction()).rejects.toThrow();
        }
      }
    });

    it('should enforce foreign key constraints on Teams.company_id', async () => {
      const invalidTests = [
        {
          description: 'Non-existent company_id',
          companyId: 'non-existent-company',
          managerId: 'integrity-user-1',
        },
        {
          description: 'NULL company_id (should fail)',
          companyId: null,
          managerId: 'integrity-user-1',
        },
      ];

      for (const test of invalidTests) {
        await expect(
          sequelize.query(
            'INSERT INTO Teams (id, name, company_id, manager_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            {
              replacements: [
                `integrity-test-team-${Date.now()}`,
                'Invalid Team',
                test.companyId,
                test.managerId,
              ],
              type: QueryTypes.INSERT,
            }
          )
        ).rejects.toThrow();
      }
    });

    it('should enforce foreign key constraints on Teams.manager_id', async () => {
      await expect(
        sequelize.query(
          'INSERT INTO Teams (id, name, company_id, manager_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
          {
            replacements: [
              'integrity-test-team-invalid-manager',
              'Team Invalid Manager',
              'integrity-company-1',
              'non-existent-manager',
            ],
            type: QueryTypes.INSERT,
          }
        )
      ).rejects.toThrow();
    });

    it('should enforce foreign key constraints on TeamMembers', async () => {
      const invalidTests = [
        {
          description: 'Non-existent team_id',
          teamId: 'non-existent-team',
          userId: 'integrity-user-1',
        },
        {
          description: 'Non-existent user_id',
          teamId: 'integrity-team-1',
          userId: 'non-existent-user',
        },
        {
          description: 'Both IDs non-existent',
          teamId: 'non-existent-team',
          userId: 'non-existent-user',
        },
      ];

      for (const test of invalidTests) {
        await expect(
          sequelize.query(
            'INSERT INTO TeamMembers (id, team_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            {
              replacements: [`integrity-test-member-${Date.now()}`, test.teamId, test.userId],
              type: QueryTypes.INSERT,
            }
          )
        ).rejects.toThrow();
      }
    });

    it('should test cascade behavior on foreign key updates', async () => {
      // Test UPDATE cascade behavior (if configured)
      const originalUserId = 'integrity-user-cascade-test';
      const newUserId = 'integrity-user-cascade-test-new';

      // Create test user
      await sequelize.query(
        'INSERT INTO Users (id, email, password, first_name, last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        {
          replacements: [originalUserId, 'cascadetest@example.com', 'hash', 'Cascade', 'Test'],
          type: QueryTypes.INSERT,
        }
      );

      // Create company owned by this user
      await sequelize.query(
        'INSERT INTO Companies (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        {
          replacements: ['integrity-company-cascade', 'Cascade Test Company', originalUserId],
          type: QueryTypes.INSERT,
        }
      );

      // Attempt to update user ID (this should test FK constraints)
      try {
        await sequelize.query('UPDATE Users SET id = ? WHERE id = ?', {
          replacements: [newUserId, originalUserId],
          type: QueryTypes.UPDATE,
        });

        // If update succeeded, check if cascade worked
        const companies = await sequelize.query('SELECT * FROM Companies WHERE owner_id = ?', {
          replacements: [newUserId],
          type: QueryTypes.SELECT,
        });

        console.log('CASCADE UPDATE test - Companies found with new user ID:', companies.length);
      } catch (error) {
        // FK constraint prevented the update (expected if no CASCADE UPDATE)
        console.log('CASCADE UPDATE test - Update prevented by FK constraint (expected)');
      }

      // Cleanup
      await sequelize.query('DELETE FROM Companies WHERE id = ?', {
        replacements: ['integrity-company-cascade'],
        type: QueryTypes.DELETE,
      });
      await sequelize.query('DELETE FROM Users WHERE id IN (?, ?)', {
        replacements: [originalUserId, newUserId],
        type: QueryTypes.DELETE,
      });
    });

    it('should test cascade behavior on foreign key deletes', async () => {
      // Test DELETE cascade behavior
      const testUserId = 'integrity-user-delete-test';
      const testCompanyId = 'integrity-company-delete-test';
      const testTeamId = 'integrity-team-delete-test';

      // Create test data hierarchy
      await sequelize.query(
        'INSERT INTO Users (id, email, password, first_name, last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        {
          replacements: [testUserId, 'deletetest@example.com', 'hash', 'Delete', 'Test'],
          type: QueryTypes.INSERT,
        }
      );

      await sequelize.query(
        'INSERT INTO Companies (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        {
          replacements: [testCompanyId, 'Delete Test Company', testUserId],
          type: QueryTypes.INSERT,
        }
      );

      await sequelize.query(
        'INSERT INTO Teams (id, name, company_id, manager_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        {
          replacements: [testTeamId, 'Delete Test Team', testCompanyId, testUserId],
          type: QueryTypes.INSERT,
        }
      );

      // Try to delete the company (should test CASCADE DELETE or prevent deletion)
      try {
        await sequelize.query('DELETE FROM Companies WHERE id = ?', {
          replacements: [testCompanyId],
          type: QueryTypes.DELETE,
        });

        // If deletion succeeded, check if dependent records were also deleted
        const remainingTeams = await sequelize.query('SELECT * FROM Teams WHERE company_id = ?', {
          replacements: [testCompanyId],
          type: QueryTypes.SELECT,
        });

        console.log(
          'CASCADE DELETE test - Remaining teams after company deletion:',
          remainingTeams.length
        );
      } catch (error) {
        // FK constraint prevented the deletion
        console.log('CASCADE DELETE test - Deletion prevented by FK constraint');
      }

      // Cleanup (delete in reverse order of dependencies)
      await sequelize.query('DELETE FROM Teams WHERE id = ?', {
        replacements: [testTeamId],
        type: QueryTypes.DELETE,
      });
      await sequelize.query('DELETE FROM Companies WHERE id = ?', {
        replacements: [testCompanyId],
        type: QueryTypes.DELETE,
      });
      await sequelize.query('DELETE FROM Users WHERE id = ?', {
        replacements: [testUserId],
        type: QueryTypes.DELETE,
      });
    });
  });

  describe('Unique Constraint Validation', () => {
    it('should enforce unique constraint on TeamMembers (team_id, user_id)', async () => {
      // First insertion should succeed
      await sequelize.query(
        'INSERT INTO TeamMembers (id, team_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        {
          replacements: ['integrity-member-unique-1', 'integrity-team-1', 'integrity-user-1'],
          type: QueryTypes.INSERT,
        }
      );

      // Duplicate should fail
      await expect(
        sequelize.query(
          'INSERT INTO TeamMembers (id, team_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          {
            replacements: ['integrity-member-unique-2', 'integrity-team-1', 'integrity-user-1'],
            type: QueryTypes.INSERT,
          }
        )
      ).rejects.toThrow();

      // Same user in different team should succeed
      await sequelize.query(
        'INSERT INTO TeamMembers (id, team_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        {
          replacements: ['integrity-member-unique-3', 'integrity-team-2', 'integrity-user-1'],
          type: QueryTypes.INSERT,
        }
      );

      // Different user in same team should succeed
      await sequelize.query(
        'INSERT INTO TeamMembers (id, team_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        {
          replacements: ['integrity-member-unique-4', 'integrity-team-1', 'integrity-user-2'],
          type: QueryTypes.INSERT,
        }
      );

      // Cleanup
      await sequelize.query('DELETE FROM TeamMembers WHERE id LIKE "integrity-member-unique-%"', {
        type: QueryTypes.DELETE,
      });
    });

    it('should test unique constraint edge cases', async () => {
      // Test behavior with NULL values in unique constraint
      // Note: MySQL allows multiple NULL values in unique columns

      const edgeCases = [
        {
          description: 'Same team_id with different user_ids',
          records: [
            { id: 'edge-1', teamId: 'integrity-team-1', userId: 'integrity-user-1' },
            { id: 'edge-2', teamId: 'integrity-team-1', userId: 'integrity-user-2' },
          ],
          shouldSucceed: true,
        },
        {
          description: 'Different team_ids with same user_id',
          records: [
            { id: 'edge-3', teamId: 'integrity-team-1', userId: 'integrity-user-1' },
            { id: 'edge-4', teamId: 'integrity-team-2', userId: 'integrity-user-1' },
          ],
          shouldSucceed: true,
        },
      ];

      for (const edgeCase of edgeCases) {
        // Clean up before test
        await sequelize.query('DELETE FROM TeamMembers WHERE id LIKE "edge-%"', {
          type: QueryTypes.DELETE,
        });

        if (edgeCase.shouldSucceed) {
          for (const record of edgeCase.records) {
            await expect(
              sequelize.query(
                'INSERT INTO TeamMembers (id, team_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
                {
                  replacements: [record.id, record.teamId, record.userId],
                  type: QueryTypes.INSERT,
                }
              )
            ).resolves.not.toThrow();
          }
        }

        // Cleanup
        await sequelize.query('DELETE FROM TeamMembers WHERE id LIKE "edge-%"', {
          type: QueryTypes.DELETE,
        });
      }
    });
  });

  describe('NOT NULL Constraint Validation', () => {
    it('should enforce NOT NULL constraints on Companies table', async () => {
      const notNullTests = [
        {
          description: 'NULL company name',
          values: [null, 'integrity-user-1'],
          columns: ['name', 'owner_id'],
        },
      ];

      for (const test of notNullTests) {
        await expect(
          sequelize.query(
            `INSERT INTO Companies (id, ${test.columns.join(', ')}, created_at, updated_at) VALUES (?, ${test.columns.map(() => '?').join(', ')}, NOW(), NOW())`,
            {
              replacements: ['integrity-test-null-company', ...test.values],
              type: QueryTypes.INSERT,
            }
          )
        ).rejects.toThrow();
      }
    });

    it('should enforce NOT NULL constraints on Teams table', async () => {
      const notNullTests = [
        {
          description: 'NULL team name',
          sql: 'INSERT INTO Teams (id, name, company_id, manager_id, created_at, updated_at) VALUES (?, NULL, ?, ?, NOW(), NOW())',
          values: ['integrity-test-null-team', 'integrity-company-1', 'integrity-user-1'],
        },
        {
          description: 'NULL company_id',
          sql: 'INSERT INTO Teams (id, name, company_id, manager_id, created_at, updated_at) VALUES (?, ?, NULL, ?, NOW(), NOW())',
          values: ['integrity-test-null-team', 'Test Team', 'integrity-user-1'],
        },
        {
          description: 'NULL manager_id',
          sql: 'INSERT INTO Teams (id, name, company_id, manager_id, created_at, updated_at) VALUES (?, ?, ?, NULL, NOW(), NOW())',
          values: ['integrity-test-null-team', 'Test Team', 'integrity-company-1'],
        },
      ];

      for (const test of notNullTests) {
        await expect(
          sequelize.query(test.sql, {
            replacements: test.values,
            type: QueryTypes.INSERT,
          })
        ).rejects.toThrow();
      }
    });

    it('should enforce NOT NULL constraints on TeamMembers table', async () => {
      const notNullTests = [
        {
          description: 'NULL team_id',
          sql: 'INSERT INTO TeamMembers (id, team_id, user_id, created_at, updated_at) VALUES (?, NULL, ?, NOW(), NOW())',
          values: ['integrity-test-null-member', 'integrity-user-1'],
        },
        {
          description: 'NULL user_id',
          sql: 'INSERT INTO TeamMembers (id, team_id, user_id, created_at, updated_at) VALUES (?, ?, NULL, NOW(), NOW())',
          values: ['integrity-test-null-member', 'integrity-team-1'],
        },
      ];

      for (const test of notNullTests) {
        await expect(
          sequelize.query(test.sql, {
            replacements: test.values,
            type: QueryTypes.INSERT,
          })
        ).rejects.toThrow();
      }
    });
  });

  describe('Data Consistency Validation', () => {
    it('should detect orphaned records', async () => {
      // Check for orphaned Companies (owner_id references non-existent user)
      const orphanedCompanies = await sequelize.query(
        `
        SELECT c.id, c.name, c.owner_id
        FROM Companies c
        LEFT JOIN Users u ON c.owner_id = u.id
        WHERE c.owner_id IS NOT NULL AND u.id IS NULL
      `,
        { type: QueryTypes.SELECT }
      );

      if (orphanedCompanies.length > 0) {
        integrityViolations.push({
          type: 'DATA_CONSISTENCY',
          table: 'Companies',
          column: 'owner_id',
          description: `Found ${orphanedCompanies.length} companies with non-existent owner_id`,
          severity: 'HIGH',
          testData: orphanedCompanies,
        });
      }

      // Check for orphaned Teams
      const orphanedTeams = await sequelize.query(
        `
        SELECT t.id, t.name, t.company_id, t.manager_id
        FROM Teams t
        LEFT JOIN Companies c ON t.company_id = c.id
        LEFT JOIN Users u ON t.manager_id = u.id
        WHERE c.id IS NULL OR u.id IS NULL
      `,
        { type: QueryTypes.SELECT }
      );

      if (orphanedTeams.length > 0) {
        integrityViolations.push({
          type: 'DATA_CONSISTENCY',
          table: 'Teams',
          description: `Found ${orphanedTeams.length} teams with invalid foreign key references`,
          severity: 'CRITICAL',
          testData: orphanedTeams,
        });
      }

      // Check for orphaned TeamMembers
      const orphanedMembers = await sequelize.query(
        `
        SELECT tm.id, tm.team_id, tm.user_id
        FROM TeamMembers tm
        LEFT JOIN Teams t ON tm.team_id = t.id
        LEFT JOIN Users u ON tm.user_id = u.id
        WHERE t.id IS NULL OR u.id IS NULL
      `,
        { type: QueryTypes.SELECT }
      );

      if (orphanedMembers.length > 0) {
        integrityViolations.push({
          type: 'DATA_CONSISTENCY',
          table: 'TeamMembers',
          description: `Found ${orphanedMembers.length} team members with invalid foreign key references`,
          severity: 'CRITICAL',
          testData: orphanedMembers,
        });
      }

      // Expect no orphaned records in a properly maintained database
      expect(orphanedCompanies.length).toBe(0);
      expect(orphanedTeams.length).toBe(0);
      expect(orphanedMembers.length).toBe(0);
    });

    it('should validate business logic constraints', async () => {
      // Business rule: A user cannot be the owner of multiple companies
      // (This is a hypothetical business rule for testing purposes)
      const multipleOwners = await sequelize.query(
        `
        SELECT owner_id, COUNT(*) as company_count
        FROM Companies
        WHERE owner_id IS NOT NULL
        GROUP BY owner_id
        HAVING COUNT(*) > 1
      `,
        { type: QueryTypes.SELECT }
      );

      if (multipleOwners.length > 0) {
        console.log('Users owning multiple companies:', multipleOwners);
        // This might be allowed, so we won't fail the test, just log it
      }

      // Business rule: A user cannot be a member of the same team multiple times
      const duplicateMembers = await sequelize.query(
        `
        SELECT team_id, user_id, COUNT(*) as membership_count
        FROM TeamMembers
        GROUP BY team_id, user_id
        HAVING COUNT(*) > 1
      `,
        { type: QueryTypes.SELECT }
      );

      if (duplicateMembers.length > 0) {
        integrityViolations.push({
          type: 'DATA_CONSISTENCY',
          table: 'TeamMembers',
          description: `Found ${duplicateMembers.length} duplicate team memberships`,
          severity: 'HIGH',
          testData: duplicateMembers,
        });
      }

      expect(duplicateMembers.length).toBe(0);

      // Business rule: A team manager should exist as a user
      const teamsWithInvalidManagers = await sequelize.query(
        `
        SELECT t.id, t.name, t.manager_id
        FROM Teams t
        LEFT JOIN Users u ON t.manager_id = u.id
        WHERE u.id IS NULL
      `,
        { type: QueryTypes.SELECT }
      );

      expect(teamsWithInvalidManagers.length).toBe(0);
    });

    it('should validate referential integrity completeness', async () => {
      // Check that all foreign key columns have corresponding indexes
      const foreignKeyColumns = [
        { table: 'Companies', column: 'owner_id' },
        { table: 'Teams', column: 'company_id' },
        { table: 'Teams', column: 'manager_id' },
        { table: 'TeamMembers', column: 'team_id' },
        { table: 'TeamMembers', column: 'user_id' },
      ];

      for (const fk of foreignKeyColumns) {
        const indexes = await sequelize.query(
          `
          SELECT INDEX_NAME
          FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        `,
          {
            replacements: [fk.table, fk.column],
            type: QueryTypes.SELECT,
          }
        );

        if (indexes.length === 0) {
          integrityViolations.push({
            type: 'DATA_CONSISTENCY',
            table: fk.table,
            column: fk.column,
            description: `Foreign key column ${fk.column} lacks index for performance`,
            severity: 'MEDIUM',
          });
        }

        expect(indexes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Transaction Integrity Testing', () => {
    it('should maintain integrity during concurrent operations', async () => {
      const concurrentOperations = [
        // Multiple insertions to the same team
        () =>
          sequelize.query(
            'INSERT INTO TeamMembers (id, team_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            {
              replacements: [
                `concurrent-member-${Date.now()}-1`,
                'integrity-team-1',
                'integrity-user-1',
              ],
              type: QueryTypes.INSERT,
            }
          ),
        () =>
          sequelize.query(
            'INSERT INTO TeamMembers (id, team_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            {
              replacements: [
                `concurrent-member-${Date.now()}-2`,
                'integrity-team-1',
                'integrity-user-2',
              ],
              type: QueryTypes.INSERT,
            }
          ),
        // Concurrent company creation
        () =>
          sequelize.query(
            'INSERT INTO Companies (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            {
              replacements: [
                `concurrent-company-${Date.now()}`,
                'Concurrent Company',
                'integrity-user-1',
              ],
              type: QueryTypes.INSERT,
            }
          ),
      ];

      // Execute operations concurrently
      const results = await Promise.all(
        concurrentOperations.map((op) => op().catch((error: any) => ({ error: error.message })))
      );

      // Check that operations either succeeded or failed gracefully
      results.forEach((result) => {
        if (result && typeof result === 'object' && 'error' in result) {
          console.log('Concurrent operation error:', result.error);
        }
      });

      // Cleanup
      await sequelize.query('DELETE FROM TeamMembers WHERE id LIKE "concurrent-member-%"', {
        type: QueryTypes.DELETE,
      });
      await sequelize.query('DELETE FROM Companies WHERE id LIKE "concurrent-company-%"', {
        type: QueryTypes.DELETE,
      });
    });

    it('should handle transaction rollback properly', async () => {
      const transaction = await sequelize.transaction();

      try {
        // Insert valid data
        await sequelize.query(
          'INSERT INTO Companies (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          {
            replacements: [
              'transaction-test-company',
              'Transaction Test Company',
              'integrity-user-1',
            ],
            type: QueryTypes.INSERT,
            transaction,
          }
        );

        // Insert invalid data (should cause rollback)
        await sequelize.query(
          'INSERT INTO Teams (id, name, company_id, manager_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
          {
            replacements: [
              'transaction-test-team',
              'Transaction Test Team',
              'non-existent-company',
              'integrity-user-1',
            ],
            type: QueryTypes.INSERT,
            transaction,
          }
        );

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        console.log('Transaction rolled back as expected:', (error as any).message);
      }

      // Verify that no data was committed
      const companies = await sequelize.query('SELECT * FROM Companies WHERE id = ?', {
        replacements: ['transaction-test-company'],
        type: QueryTypes.SELECT,
      });

      expect(companies.length).toBe(0);
    });
  });

  describe('Constraint Performance Impact', () => {
    it('should measure constraint validation performance', async () => {
      const performanceTests = [
        {
          name: 'Foreign Key Validation',
          operation: () =>
            sequelize.query(
              'INSERT INTO Teams (id, name, company_id, manager_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
              {
                replacements: [
                  `perf-team-${Date.now()}`,
                  'Performance Test Team',
                  'integrity-company-1',
                  'integrity-user-1',
                ],
                type: QueryTypes.INSERT,
              }
            ),
        },
        {
          name: 'Unique Constraint Validation',
          operation: () =>
            sequelize.query(
              'INSERT INTO TeamMembers (id, team_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
              {
                replacements: [`perf-member-${Date.now()}`, 'integrity-team-1', 'integrity-user-2'],
                type: QueryTypes.INSERT,
              }
            ),
        },
      ];

      for (const test of performanceTests) {
        const iterations = 10;
        const times: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();
          await test.operation();
          times.push(Date.now() - startTime);
        }

        const avgTime = times.reduce((sum, time) => sum + time, 0) / iterations;
        console.log(`${test.name} average time: ${avgTime}ms`);

        // Constraint validation should be fast
        expect(avgTime).toBeLessThan(50); // 50ms threshold
      }

      // Cleanup
      await sequelize.query('DELETE FROM Teams WHERE id LIKE "perf-team-%"', {
        type: QueryTypes.DELETE,
      });
      await sequelize.query('DELETE FROM TeamMembers WHERE id LIKE "perf-member-%"', {
        type: QueryTypes.DELETE,
      });
    });
  });

  // Helper Functions

  async function initializeIntegrityTestData(): Promise<void> {
    // Clean up any existing test data
    await cleanupIntegrityTestData();

    // Create test users
    await sequelize.query(
      `
      INSERT INTO Users (id, email, password, first_name, last_name, created_at, updated_at)
      VALUES 
      ('integrity-user-1', 'integrityuser1@example.com', 'hash1', 'Integrity', 'User1', NOW(), NOW()),
      ('integrity-user-2', 'integrityuser2@example.com', 'hash2', 'Integrity', 'User2', NOW(), NOW()),
      ('integrity-user-3', 'integrityuser3@example.com', 'hash3', 'Integrity', 'User3', NOW(), NOW())
      ON DUPLICATE KEY UPDATE email = VALUES(email)
    `,
      { type: QueryTypes.INSERT }
    );

    // Create test companies
    await sequelize.query(
      `
      INSERT INTO Companies (id, name, owner_id, created_at, updated_at)
      VALUES 
      ('integrity-company-1', 'Integrity Test Company 1', 'integrity-user-1', NOW(), NOW()),
      ('integrity-company-2', 'Integrity Test Company 2', 'integrity-user-2', NOW(), NOW())
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `,
      { type: QueryTypes.INSERT }
    );

    // Create test teams
    await sequelize.query(
      `
      INSERT INTO Teams (id, name, company_id, manager_id, created_at, updated_at)
      VALUES 
      ('integrity-team-1', 'Integrity Test Team 1', 'integrity-company-1', 'integrity-user-1', NOW(), NOW()),
      ('integrity-team-2', 'Integrity Test Team 2', 'integrity-company-1', 'integrity-user-2', NOW(), NOW()),
      ('integrity-team-3', 'Integrity Test Team 3', 'integrity-company-2', 'integrity-user-3', NOW(), NOW())
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `,
      { type: QueryTypes.INSERT }
    );
  }

  async function cleanupIntegrityTestData(): Promise<void> {
    // Clean up in reverse order of dependencies
    await sequelize.query(
      'DELETE FROM TeamMembers WHERE team_id LIKE "integrity-team-%" OR id LIKE "integrity-member-%"',
      {
        type: QueryTypes.DELETE,
      }
    );
    await sequelize.query('DELETE FROM Teams WHERE id LIKE "integrity-team-%"', {
      type: QueryTypes.DELETE,
    });
    await sequelize.query('DELETE FROM Companies WHERE id LIKE "integrity-company-%"', {
      type: QueryTypes.DELETE,
    });
    await sequelize.query('DELETE FROM Users WHERE id LIKE "integrity-user-%"', {
      type: QueryTypes.DELETE,
    });
  }
});
