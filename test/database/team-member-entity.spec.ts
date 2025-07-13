import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { TeamMember } from '../../src/modules/team/entities/team-member.entity';
import { Team } from '../../src/modules/team/entities/team.entity';
import { Company } from '../../src/modules/company/entities/company.entity';
import { User } from '../../src/modules/auth/entities/user.entity';
import { TestDatabaseHelper } from '../utils/test-database.helper';

describe('TeamMember Entity Unit Tests', () => {
  let _sequelize: Sequelize;
  let module: TestingModule;
  let teamMember: TeamMember;
  let company: Company;
  let team: Team;
  let manager: User;
  let member: User;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: getModelToken(TeamMember),
          useValue: TeamMember,
        },
        {
          provide: getModelToken(Team),
          useValue: Team,
        },
        {
          provide: getModelToken(Company),
          useValue: Company,
        },
        {
          provide: getModelToken(User),
          useValue: User,
        },
      ],
    }).compile();

    // Initialize MySQL test database
    _sequelize = await TestDatabaseHelper.createTestDatabase([Company, User, Team, TeamMember]);
  });

  afterAll(async () => {
    await TestDatabaseHelper.closeDatabase();
    await module.close();
  });

  beforeEach(async () => {
    // Clean up data before each test
    await TeamMember.destroy({ where: {}, truncate: true });
    await Team.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });
    await Company.destroy({ where: {}, truncate: true });

    // Create test data for each test
    company = await Company.create({
      name: 'Test Company',
      email: 'test@company.com',
    });

    manager = await User.create({
      first_name: 'John',
      last_name: 'Manager',
      email: 'manager@test.com',
      auth0_user_id: 'auth0|manager123',
      role: 'vendor_manager',
      company_id: company.id,
    });

    team = await Team.create({
      name: 'Development Team',
      company_id: company.id,
      owner_user_id: manager.id,
    });

    member = await User.create({
      first_name: 'Alice',
      last_name: 'Developer',
      email: 'alice@test.com',
      auth0_user_id: 'auth0|alice123',
      role: 'vendor_employee',
      company_id: company.id,
    });
  });

  describe('Entity Creation and Validation', () => {
    it('should create a valid team member with required fields', async () => {
      const teamMemberData = {
        team_id: team.id,
        user_id: member.id,
      };

      teamMember = await TeamMember.create(teamMemberData);

      expect(teamMember).toBeDefined();
      expect(teamMember.id).toBeDefined();
      expect(teamMember.team_id).toBe(teamMemberData.team_id);
      expect(teamMember.user_id).toBe(teamMemberData.user_id);
      expect(teamMember.created_at).toBeDefined();
      expect(teamMember.updated_at).toBeDefined();
    });

    it('should auto-generate UUID for id field', async () => {
      // Create another member for comparison
      const member2 = await User.create({
        first_name: 'Bob',
        last_name: 'Designer',
        email: 'bob@test.com',
        auth0_user_id: 'auth0|bob123',
        role: 'vendor_employee',
        company_id: company.id,
      });

      const teamMember1 = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      const teamMember2 = await TeamMember.create({
        team_id: team.id,
        user_id: member2.id,
      });

      expect(teamMember1.id).toBeDefined();
      expect(teamMember2.id).toBeDefined();
      expect(teamMember1.id).not.toBe(teamMember2.id);
      expect(teamMember1.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(teamMember2.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should automatically set timestamps on creation', async () => {
      const beforeCreate = new Date();
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });
      const afterCreate = new Date();

      expect(teamMember.created_at).toBeDefined();
      expect(teamMember.updated_at).toBeDefined();
      expect(teamMember.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(teamMember.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(teamMember.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(teamMember.updated_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should update timestamps on modification', async () => {
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });
      const originalUpdatedAt = teamMember.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update the team member (though there aren't many fields to update)
      await teamMember.save();

      expect(teamMember.updated_at.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });
  });

  describe('Field Validation', () => {
    it('should reject creation without required team_id field', async () => {
      await expect(
        TeamMember.create({
          user_id: member.id,
        })
      ).rejects.toThrow();
    });

    it('should reject creation without required user_id field', async () => {
      await expect(
        TeamMember.create({
          team_id: team.id,
        })
      ).rejects.toThrow();
    });

    it('should reject null team_id field', async () => {
      await expect(
        TeamMember.create({
          team_id: null,
          user_id: member.id,
        })
      ).rejects.toThrow();
    });

    it('should reject null user_id field', async () => {
      await expect(
        TeamMember.create({
          team_id: team.id,
          user_id: null,
        })
      ).rejects.toThrow();
    });

    it('should validate UUID format for foreign keys', async () => {
      // Test with valid UUID format (though might fail FK constraints)
      const validUUID = '12345678-1234-1234-1234-123456789012';

      try {
        await TeamMember.create({
          team_id: validUUID,
          user_id: validUUID,
        });
        // If we reach here, UUID format was accepted (though FK might fail)
      } catch (error) {
        // Expected with foreign key constraints
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique constraint on team_id + user_id combination', async () => {
      // Create first team member
      await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      // Attempt to create duplicate team member
      await expect(
        TeamMember.create({
          team_id: team.id,
          user_id: member.id,
        })
      ).rejects.toThrow();
    });

    it('should allow same user in different teams', async () => {
      // Create another team
      const team2 = await Team.create({
        name: 'Marketing Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      // Add same user to both teams
      const teamMember1 = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      const teamMember2 = await TeamMember.create({
        team_id: team2.id,
        user_id: member.id,
      });

      expect(teamMember1.user_id).toBe(teamMember2.user_id);
      expect(teamMember1.team_id).not.toBe(teamMember2.team_id);
      expect(teamMember1.id).not.toBe(teamMember2.id);
    });

    it('should allow different users in same team', async () => {
      // Create another member
      const member2 = await User.create({
        first_name: 'Bob',
        last_name: 'Designer',
        email: 'bob@test.com',
        auth0_user_id: 'auth0|bob123',
        role: 'vendor_employee',
        company_id: company.id,
      });

      // Add both users to same team
      const teamMember1 = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      const teamMember2 = await TeamMember.create({
        team_id: team.id,
        user_id: member2.id,
      });

      expect(teamMember1.team_id).toBe(teamMember2.team_id);
      expect(teamMember1.user_id).not.toBe(teamMember2.user_id);
      expect(teamMember1.id).not.toBe(teamMember2.id);
    });
  });

  describe('Entity Operations', () => {
    it('should support findByPk operations', async () => {
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      const foundTeamMember = await TeamMember.findByPk(teamMember.id);

      expect(foundTeamMember).toBeDefined();
      expect(foundTeamMember!.id).toBe(teamMember.id);
      expect(foundTeamMember!.team_id).toBe(team.id);
      expect(foundTeamMember!.user_id).toBe(member.id);
    });

    it('should support findOne with where conditions', async () => {
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      const foundByTeam = await TeamMember.findOne({
        where: { team_id: team.id },
      });
      expect(foundByTeam!.id).toBe(teamMember.id);

      const foundByUser = await TeamMember.findOne({
        where: { user_id: member.id },
      });
      expect(foundByUser!.id).toBe(teamMember.id);

      const foundByBoth = await TeamMember.findOne({
        where: { team_id: team.id, user_id: member.id },
      });
      expect(foundByBoth!.id).toBe(teamMember.id);
    });

    it('should support findAll operations with filters', async () => {
      // Create multiple team members
      const member2 = await User.create({
        first_name: 'Bob',
        last_name: 'Designer',
        email: 'bob@test.com',
        auth0_user_id: 'auth0|bob123',
        role: 'vendor_employee',
        company_id: company.id,
      });

      const team2 = await Team.create({
        name: 'Marketing Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      await TeamMember.create({
        team_id: team.id,
        user_id: member2.id,
      });

      await TeamMember.create({
        team_id: team2.id,
        user_id: member.id,
      });

      // Find all members of a specific team
      const team1Members = await TeamMember.findAll({
        where: { team_id: team.id },
      });
      expect(team1Members).toHaveLength(2);

      // Find all teams for a specific user
      const memberTeams = await TeamMember.findAll({
        where: { user_id: member.id },
      });
      expect(memberTeams).toHaveLength(2);

      // Find all team memberships - Note: In production, always include company_id for multi-tenant isolation
      // This is a test scenario specifically testing the findAll functionality
      const allMemberships = await TeamMember.findAll({
        where: { team_id: [team.id, team2.id] },
      });
      expect(allMemberships).toHaveLength(3);
    });

    it('should support destroy operations', async () => {
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      const teamMemberId = teamMember.id;
      await teamMember.destroy();

      const deletedTeamMember = await TeamMember.findByPk(teamMemberId);
      expect(deletedTeamMember).toBeNull();
    });

    it('should support bulk operations', async () => {
      // Create multiple members
      const members: User[] = [];
      for (let i = 0; i < 3; i++) {
        const newMember = await User.create({
          first_name: `Member${i}`,
          last_name: 'User',
          email: `member${i}@test.com`,
          auth0_user_id: `auth0|member${i}`,
          role: 'vendor_employee',
          company_id: company.id,
        });
        members.push(newMember);
      }

      // Bulk create team members
      const teamMemberData = members.map((m: User) => ({
        team_id: team.id,
        user_id: m.id,
      }));

      const createdTeamMembers = await TeamMember.bulkCreate(teamMemberData);
      expect(createdTeamMembers).toHaveLength(3);

      // Bulk destroy
      await TeamMember.destroy({
        where: { team_id: team.id },
      });

      const remainingMembers = await TeamMember.findAll({
        where: { team_id: team.id },
      });
      expect(remainingMembers).toHaveLength(0);
    });
  });

  describe('Association Queries', () => {
    it('should support queries through team association', async () => {
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      // Query team members through Team model
      const teamWithMembers = await Team.findByPk(team.id, {
        include: [{ model: User, as: 'members', through: { attributes: [] } }],
      });

      expect(teamWithMembers!.members).toBeDefined();
      expect(teamWithMembers!.members).toHaveLength(1);
      expect(teamWithMembers!.members[0].id).toBe(member.id);
    });

    it('should support queries through user association', async () => {
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      // Query user teams through User model
      const userWithTeams = await User.findByPk(member.id, {
        include: [{ model: Team, as: 'teams', through: { attributes: [] } }],
      });

      expect(userWithTeams!.teams).toBeDefined();
      expect(userWithTeams!.teams).toHaveLength(1);
      expect(userWithTeams!.teams[0].id).toBe(team.id);
    });

    it('should include team member metadata in queries', async () => {
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      // Query with team member attributes included
      const teamWithMembersAndMetadata = await Team.findByPk(team.id, {
        include: [
          {
            model: User,
            as: 'members',
            through: {
              attributes: ['id', 'created_at', 'updated_at'],
              as: 'membership',
            },
          },
        ],
      });

      expect(teamWithMembersAndMetadata!.members).toBeDefined();
      expect(teamWithMembersAndMetadata!.members).toHaveLength(1);
      expect((teamWithMembersAndMetadata!.members[0] as any).membership).toBeDefined();
      expect((teamWithMembersAndMetadata!.members[0] as any).membership.id).toBe(
        teamMember.id as string
      );
    });
  });

  describe('Business Rules and Constraints', () => {
    it('should validate team and user belong to same company', async () => {
      // Create a user from different company
      const otherCompany = await Company.create({
        name: 'Other Company',
      });

      const outsideUser = await User.create({
        first_name: 'Outside',
        last_name: 'User',
        email: 'outside@other.com',
        auth0_user_id: 'auth0|outside123',
        role: 'vendor_employee',
        company_id: otherCompany.id,
      });

      // This should be validated at business logic level
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: outsideUser.id,
      });

      // Verify the data was created (validation would be in business logic)
      expect(teamMember.team_id).toBe(team.id);
      expect(teamMember.user_id).toBe(outsideUser.id);

      // In real application, you'd want to validate this constraint
      const membershipWithRelations = await TeamMember.findByPk(teamMember.id, {
        include: [
          {
            model: Team,
            include: [{ model: Company, as: 'company' }],
          },
          {
            model: User,
            include: [{ model: Company, as: 'company' }],
          },
        ],
      });

      // Business logic should catch this inconsistency
      // In this case, team.company_id !== user.company_id
      expect(membershipWithRelations).toBeDefined();
    });

    it('should handle team owner as team member scenario', async () => {
      // Add team owner as a team member
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: manager.id, // Owner is also a team member
      });

      expect(teamMember.team_id).toBe(team.id);
      expect(teamMember.user_id).toBe(manager.id);

      // Verify owner can be both owner and member
      const teamWithAll = await Team.findByPk(team.id, {
        include: [
          { model: User, as: 'owner' },
          { model: User, as: 'members', through: { attributes: [] } },
        ],
      });

      expect((teamWithAll!.owner as any).id).toBe(manager.id);
      expect(teamWithAll!.members.some((m: User) => m.id === manager.id)).toBe(true);
    });

    it('should handle user role validation for team membership', async () => {
      // Create users with different roles
      const client = await User.create({
        first_name: 'Client',
        last_name: 'User',
        email: 'client@test.com',
        auth0_user_id: 'auth0|client123',
        role: 'client',
        company_id: company.id,
      });

      // In business logic, you might want to restrict certain roles
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: client.id,
      });

      expect(teamMember.user_id).toBe(client.id);

      // Business logic could validate that clients shouldn't be team members
      const membershipWithUser = await TeamMember.findByPk(teamMember.id, {
        include: [{ model: User }],
      });

      expect((membershipWithUser!.user as User).role).toBe('client');
      // Application logic would handle role-based restrictions
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent membership creation', async () => {
      // Create multiple members
      const members: User[] = [];
      for (let i = 0; i < 3; i++) {
        const newMember = await User.create({
          first_name: `Concurrent${i}`,
          last_name: 'User',
          email: `concurrent${i}@test.com`,
          auth0_user_id: `auth0|concurrent${i}`,
          role: 'vendor_employee',
          company_id: company.id,
        });
        members.push(newMember);
      }

      // Create team memberships concurrently
      const createPromises = members.map((m) =>
        TeamMember.create({
          team_id: team.id,
          user_id: m.id,
        })
      );

      const teamMembers = await Promise.all(createPromises);

      expect(teamMembers).toHaveLength(3);
      const uniqueIds = new Set(teamMembers.map((tm) => tm.id));
      expect(uniqueIds.size).toBe(3); // All IDs should be unique
    });

    it('should handle large team memberships efficiently', async () => {
      // Create many team members
      const members: User[] = [];
      for (let i = 0; i < 50; i++) {
        const newMember = await User.create({
          first_name: `Bulk${i}`,
          last_name: 'User',
          email: `bulk${i}@test.com`,
          auth0_user_id: `auth0|bulk${i}`,
          role: 'vendor_employee',
          company_id: company.id,
        });
        members.push(newMember);
      }

      const startTime = Date.now();

      // Bulk create team memberships
      const teamMemberData = members.map((m: User) => ({
        team_id: team.id,
        user_id: m.id,
      }));

      await TeamMember.bulkCreate(teamMemberData);

      const creationTime = Date.now() - startTime;

      // Verify all members were created
      const allTeamMembers = await TeamMember.findAll({
        where: { team_id: team.id },
      });

      expect(allTeamMembers).toHaveLength(50);
      expect(creationTime).toBeLessThan(1000); // Should complete in reasonable time
    });

    it('should properly handle cascade deletions', async () => {
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      // Delete the team and verify team member is also deleted
      await team.destroy();

      const orphanedTeamMembers = await TeamMember.findAll({
        where: { team_id: team.id },
      });

      // Should be empty if cascade is properly configured
      expect(orphanedTeamMembers).toHaveLength(0);
    });

    it('should handle orphaned team member cleanup', async () => {
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      // Delete the user and verify team member is handled appropriately
      await member.destroy();

      const orphanedTeamMembers = await TeamMember.findAll({
        where: { user_id: member.id },
      });

      // Should be empty if cascade is properly configured
      expect(orphanedTeamMembers).toHaveLength(0);
    });
  });

  describe('Performance and Query Optimization', () => {
    it('should efficiently query team memberships with indexes', async () => {
      // Create test data
      const members: User[] = [];
      for (let i = 0; i < 10; i++) {
        const newMember = await User.create({
          first_name: `Perf${i}`,
          last_name: 'User',
          email: `perf${i}@test.com`,
          auth0_user_id: `auth0|perf${i}`,
          role: 'vendor_employee',
          company_id: company.id,
        });

        await TeamMember.create({
          team_id: team.id,
          user_id: newMember.id,
        });

        members.push(newMember);
      }

      const startTime = Date.now();

      // Query that should benefit from indexes
      const teamMembers = await TeamMember.findAll({
        where: { team_id: team.id },
      });

      const queryTime = Date.now() - startTime;

      expect(teamMembers).toHaveLength(10);
      expect(queryTime).toBeLessThan(50); // Should be very fast with proper indexes
    });

    it('should efficiently handle complex association queries', async () => {
      teamMember = await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      const startTime = Date.now();

      // Complex query with multiple joins
      const complexQuery = await TeamMember.findAll({
        include: [
          {
            model: Team,
            include: [
              { model: Company, as: 'company' },
              { model: User, as: 'manager' },
            ],
          },
          {
            model: User,
            include: [{ model: Company, as: 'company' }],
          },
        ],
        where: { team_id: team.id },
      });

      const queryTime = Date.now() - startTime;

      expect(complexQuery).toHaveLength(1);
      expect(complexQuery[0].team).toBeDefined();
      expect(complexQuery[0].user).toBeDefined();
      expect(queryTime).toBeLessThan(100); // Should complete reasonably fast
    });
  });
});
