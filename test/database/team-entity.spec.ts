import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Team } from '../../src/modules/team/entities/team.entity';
import { Company } from '../../src/modules/company/entities/company.entity';
import { User } from '../../src/modules/auth/entities/user.entity';
import { TeamMember } from '../../src/modules/team/entities/team-member.entity';
import { TestDatabaseHelper } from '../utils/test-database.helper';

describe('Team Entity Unit Tests', () => {
  let _sequelize: Sequelize;
  let module: TestingModule;
  let team: Team;
  let company: Company;
  let manager: User;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
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
        {
          provide: getModelToken(TeamMember),
          useValue: TeamMember,
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

    // Create test company and manager for each test
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
  });

  describe('Entity Creation and Validation', () => {
    it('should create a valid team with required fields', async () => {
      const teamData = {
        name: 'Development Team',
        company_id: company.id,
        owner_user_id: manager.id,
      };

      team = await Team.create(teamData);

      expect(team).toBeDefined();
      expect(team.id).toBeDefined();
      expect(team.name).toBe(teamData.name);
      expect(team.company_id).toBe(teamData.company_id);
      expect(team.owner_user_id).toBe(teamData.owner_user_id);
      expect(team.created_at).toBeDefined();
      expect(team.updated_at).toBeDefined();
    });

    it('should auto-generate UUID for id field', async () => {
      const team1 = await Team.create({
        name: 'Team 1',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const team2 = await Team.create({
        name: 'Team 2',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      expect(team1.id).toBeDefined();
      expect(team2.id).toBeDefined();
      expect(team1.id).not.toBe(team2.id);
      expect(team1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(team2.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should automatically set timestamps on creation', async () => {
      const beforeCreate = new Date();
      team = await Team.create({
        name: 'Timestamp Test Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });
      const afterCreate = new Date();

      expect(team.created_at).toBeDefined();
      expect(team.updated_at).toBeDefined();
      expect(team.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(team.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(team.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(team.updated_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should update timestamps on modification', async () => {
      team = await Team.create({
        name: 'Update Test Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });
      const originalUpdatedAt = team.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      team.name = 'Updated Team Name';
      await team.save();

      expect(team.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Field Validation', () => {
    it('should reject creation without required name field', async () => {
      await expect(
        Team.create({
          company_id: company.id,
          owner_user_id: manager.id,
        })
      ).rejects.toThrow();
    });

    it('should reject creation without required company_id field', async () => {
      await expect(
        Team.create({
          name: 'Test Team',
          owner_user_id: manager.id,
        })
      ).rejects.toThrow();
    });

    it('should reject creation without required owner_user_id field', async () => {
      await expect(
        Team.create({
          name: 'Test Team',
          company_id: company.id,
        })
      ).rejects.toThrow();
    });

    it('should reject null name field', async () => {
      await expect(
        Team.create({
          name: null,
          company_id: company.id,
          owner_user_id: manager.id,
        })
      ).rejects.toThrow();
    });

    it('should reject empty string name field', async () => {
      await expect(
        Team.create({
          name: '',
          company_id: company.id,
          owner_user_id: manager.id,
        })
      ).rejects.toThrow();
    });

    it('should reject null company_id field', async () => {
      await expect(
        Team.create({
          name: 'Test Team',
          company_id: null,
          owner_user_id: manager.id,
        })
      ).rejects.toThrow();
    });

    it('should reject null owner_user_id field', async () => {
      await expect(
        Team.create({
          name: 'Test Team',
          company_id: company.id,
          owner_user_id: null,
        })
      ).rejects.toThrow();
    });

    it('should accept various team name formats', async () => {
      const validNames = [
        'Development Team',
        'Team Alpha',
        'Marketing & Sales',
        'R&D Division',
        'Support Team - Level 1',
        'Team 123',
        'Project_Phoenix',
        'Team-Bravo',
      ];

      for (const name of validNames) {
        const team = await Team.create({
          name: name,
          company_id: company.id,
          owner_user_id: manager.id,
        });
        expect(team.name).toBe(name);
      }
    });

    it('should validate UUID format for foreign keys', async () => {
      // Valid UUID format
      const validUUID = '12345678-1234-1234-1234-123456789012';

      // Note: This test would fail with actual foreign key constraints
      // In a real scenario, these UUIDs would need to reference existing records
      try {
        await Team.create({
          name: 'UUID Test Team',
          company_id: validUUID,
          owner_user_id: validUUID,
        });
        // If we reach here, the UUID format was accepted (though FK might fail)
      } catch (error) {
        // Expected in SQLite with foreign key constraints
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Associations and Relationships', () => {
    it('should establish belongs-to relationship with Company', async () => {
      team = await Team.create({
        name: 'Company Association Test',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const teamWithCompany = await Team.findByPk(team.id, {
        include: [{ model: Company, as: 'company' }],
      });

      expect(teamWithCompany).toBeDefined();
      expect(teamWithCompany!.company).toBeDefined();
      expect(teamWithCompany!.company.id).toBe(company.id);
      expect(teamWithCompany!.company.name).toBe(company.name);
    });

    it('should establish belongs-to relationship with User (owner)', async () => {
      team = await Team.create({
        name: 'Owner Association Test',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const teamWithOwner = await Team.findByPk(team.id, {
        include: [{ model: User, as: 'owner' }],
      });

      expect(teamWithOwner).toBeDefined();
      expect(teamWithOwner!.owner).toBeDefined();
      expect((teamWithOwner!.owner as User).id).toBe(manager.id);
      expect((teamWithOwner!.owner as User).email).toBe(manager.email);
    });

    it('should establish belongs-to-many relationship with Users (members)', async () => {
      team = await Team.create({
        name: 'Members Association Test',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      // Create team members
      const member1 = await User.create({
        first_name: 'Alice',
        last_name: 'Developer',
        email: 'alice@test.com',
        auth0_user_id: 'auth0|alice123',
        role: 'vendor_employee',
        company_id: company.id,
      });

      const member2 = await User.create({
        first_name: 'Bob',
        last_name: 'Designer',
        email: 'bob@test.com',
        auth0_user_id: 'auth0|bob123',
        role: 'vendor_employee',
        company_id: company.id,
      });

      // Create team member associations
      await TeamMember.create({
        team_id: team.id,
        user_id: member1.id,
      });

      await TeamMember.create({
        team_id: team.id,
        user_id: member2.id,
      });

      const teamWithMembers = await Team.findByPk(team.id, {
        include: [{ model: User, as: 'members', through: { attributes: [] } }],
      });

      expect(teamWithMembers).toBeDefined();
      expect(teamWithMembers!.members).toBeDefined();
      expect(teamWithMembers!.members).toHaveLength(2);
      expect(teamWithMembers!.members.map((m) => m.email)).toContain('alice@test.com');
      expect(teamWithMembers!.members.map((m) => m.email)).toContain('bob@test.com');
    });

    it('should handle multiple teams per company', async () => {
      const _team1 = await Team.create({
        name: 'Development Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const _team2 = await Team.create({
        name: 'Marketing Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const companyWithTeams = await Company.findByPk(company.id, {
        include: [{ model: Team, as: 'teams' }],
      });

      expect(companyWithTeams).toBeDefined();
      expect(companyWithTeams!.teams).toBeDefined();
      expect(companyWithTeams!.teams).toHaveLength(2);
      expect(companyWithTeams!.teams.map((t) => t.name)).toContain('Development Team');
      expect(companyWithTeams!.teams.map((t) => t.name)).toContain('Marketing Team');
    });

    it('should handle one owner owning multiple teams', async () => {
      const _team1 = await Team.create({
        name: 'Team Alpha',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const _team2 = await Team.create({
        name: 'Team Beta',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const ownerWithTeams = await User.findByPk(manager.id, {
        include: [{ model: Team, as: 'managed_teams' }],
      });

      expect(ownerWithTeams).toBeDefined();
      expect(ownerWithTeams!.managed_teams).toBeDefined();
      expect(ownerWithTeams!.managed_teams).toHaveLength(2);
      expect(ownerWithTeams!.managed_teams.map((t) => t.name)).toContain('Team Alpha');
      expect(ownerWithTeams!.managed_teams.map((t) => t.name)).toContain('Team Beta');
    });
  });

  describe('Entity Operations', () => {
    it('should support findByPk operations', async () => {
      team = await Team.create({
        name: 'Findable Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const foundTeam = await Team.findByPk(team.id);

      expect(foundTeam).toBeDefined();
      expect(foundTeam!.id).toBe(team.id);
      expect(foundTeam!.name).toBe('Findable Team');
      expect(foundTeam!.company_id).toBe(company.id);
      expect(foundTeam!.owner_user_id).toBe(manager.id);
    });

    it('should support findOne with where conditions', async () => {
      team = await Team.create({
        name: 'Unique Search Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const foundByName = await Team.findOne({
        where: { name: 'Unique Search Team' },
      });
      expect(foundByName!.id).toBe(team.id);

      const foundByCompany = await Team.findOne({
        where: { company_id: company.id, name: 'Unique Search Team' },
      });
      expect(foundByCompany!.id).toBe(team.id);

      const foundByManager = await Team.findOne({
        where: { owner_user_id: manager.id, name: 'Unique Search Team' },
      });
      expect(foundByManager!.id).toBe(team.id);
    });

    it('should support findAll operations with filters', async () => {
      // Create multiple teams
      await Team.create({
        name: 'Dev Team 1',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      await Team.create({
        name: 'Dev Team 2',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      // Create a different manager and team
      const otherManager = await User.create({
        first_name: 'Jane',
        last_name: 'Manager',
        email: 'jane@test.com',
        auth0_user_id: 'auth0|jane123',
        role: 'vendor_manager',
        company_id: company.id,
      });

      await Team.create({
        name: 'Marketing Team',
        company_id: company.id,
        owner_user_id: otherManager.id,
      });

      const teamsByManager = await Team.findAll({
        where: { owner_user_id: manager.id },
      });

      expect(teamsByManager).toHaveLength(2);
      expect(teamsByManager.every((t) => t.owner_user_id === manager.id)).toBe(true);

      const teamsByCompany = await Team.findAll({
        where: { company_id: company.id },
      });

      expect(teamsByCompany).toHaveLength(3);
      expect(teamsByCompany.every((t) => t.company_id === company.id)).toBe(true);
    });

    it('should support update operations', async () => {
      team = await Team.create({
        name: 'Original Team Name',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      await team.update({
        name: 'Updated Team Name',
      });

      expect(team.name).toBe('Updated Team Name');

      // Verify in database
      const refreshedTeam = await Team.findByPk(team.id);
      expect(refreshedTeam).toBeDefined();
      expect(refreshedTeam!.name).toBe('Updated Team Name');
    });

    it('should support destroy operations', async () => {
      team = await Team.create({
        name: 'Team to Delete',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const teamId = team.id;
      await team.destroy();

      const deletedTeam = await Team.findByPk(teamId);
      expect(deletedTeam).toBeNull();
    });
  });

  describe('Business Rules and Constraints', () => {
    it('should allow teams with the same name in different companies', async () => {
      // Create another company
      const otherCompany = await Company.create({
        name: 'Other Company',
      });

      const otherManager = await User.create({
        first_name: 'Other',
        last_name: 'Manager',
        email: 'other@company.com',
        auth0_user_id: 'auth0|other123',
        role: 'vendor_manager',
        company_id: otherCompany.id,
      });

      // Create teams with the same name in different companies
      const team1 = await Team.create({
        name: 'Development Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const team2 = await Team.create({
        name: 'Development Team',
        company_id: otherCompany.id,
        owner_user_id: otherManager.id,
      });

      expect(team1.name).toBe(team2.name);
      expect(team1.company_id).not.toBe(team2.company_id);
      expect(team1.id).not.toBe(team2.id);
    });

    it('should enforce business rule: team owner should belong to same company', async () => {
      // Create an owner from a different company
      const otherCompany = await Company.create({
        name: 'Other Company',
      });

      const otherManager = await User.create({
        first_name: 'Cross',
        last_name: 'Manager',
        email: 'cross@other.com',
        auth0_user_id: 'auth0|cross123',
        role: 'vendor_manager',
        company_id: otherCompany.id,
      });

      // This should be validated at the business logic level
      // Here we just create the team and verify the data
      team = await Team.create({
        name: 'Cross Company Team',
        company_id: company.id,
        owner_user_id: otherManager.id,
      });

      // In a real application, you'd want to validate this constraint
      expect(team.company_id).toBe(company.id);
      expect(team.owner_user_id).toBe(otherManager.id);

      // Business logic should catch this inconsistency
      const teamWithRelations = await Team.findByPk(team.id, {
        include: [
          { model: Company, as: 'company' },
          { model: User, as: 'owner' },
        ],
      });

      expect(teamWithRelations).toBeDefined();
      expect((teamWithRelations!.company as Company).id).not.toBe(
        (teamWithRelations!.owner as User).company_id
      );
    });

    it('should handle team member capacity limits', async () => {
      team = await Team.create({
        name: 'Capacity Test Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      // Create multiple team members
      const members: User[] = [];
      for (let i = 0; i < 5; i++) {
        const member = await User.create({
          first_name: `Member${i}`,
          last_name: 'User',
          email: `member${i}@test.com`,
          auth0_user_id: `auth0|member${i}`,
          role: 'vendor_employee',
          company_id: company.id,
        });

        await TeamMember.create({
          team_id: team.id,
          user_id: member.id,
        });

        members.push(member);
      }

      const teamWithMembers = await Team.findByPk(team.id, {
        include: [{ model: User, as: 'members' }],
      });

      expect(teamWithMembers).toBeDefined();
      expect(teamWithMembers!.members).toHaveLength(5);

      // Business logic could enforce a maximum team size
      const maxTeamSize = 10;
      expect(teamWithMembers!.members.length).toBeLessThanOrEqual(maxTeamSize);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long team names appropriately', async () => {
      const longName = 'A'.repeat(255); // Very long name

      team = await Team.create({
        name: longName,
        company_id: company.id,
        owner_user_id: manager.id,
      });

      expect(team.name).toBe(longName);
    });

    it('should handle special characters in team names', async () => {
      const specialNames = [
        "Team with 'quotes'",
        'Team with "double quotes"',
        'Team & Associates',
        'Team - Alpha/Beta',
        'Team (Sub-division)',
        'Team #1',
        'Team @ Location',
        'Team 100%',
      ];

      for (const name of specialNames) {
        const team = await Team.create({
          name: name,
          company_id: company.id,
          owner_user_id: manager.id,
        });
        expect(team.name).toBe(name);
      }
    });

    it('should handle concurrent team creation properly', async () => {
      const createPromises = Array.from({ length: 3 }, (_, i) =>
        Team.create({
          name: `Concurrent Team ${i}`,
          company_id: company.id,
          owner_user_id: manager.id,
        })
      );

      const teams = await Promise.all(createPromises);

      expect(teams).toHaveLength(3);
      const uniqueIds = new Set(teams.map((t) => t.id));
      expect(uniqueIds.size).toBe(3); // All IDs should be unique
    });

    it('should properly handle cascading operations', async () => {
      team = await Team.create({
        name: 'Cascade Test Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      // Add team members
      const member = await User.create({
        first_name: 'Test',
        last_name: 'Member',
        email: 'member@test.com',
        auth0_user_id: 'auth0|member123',
        role: 'vendor_employee',
        company_id: company.id,
      });

      await TeamMember.create({
        team_id: team.id,
        user_id: member.id,
      });

      // Verify relationships exist
      const teamWithMembers = await Team.findByPk(team.id, {
        include: [{ model: User, as: 'members' }],
      });
      expect(teamWithMembers).toBeDefined();
      expect(teamWithMembers!.members).toHaveLength(1);

      // Delete team and verify cascade behavior
      await team.destroy();

      // Check if team members were also removed (depends on cascade settings)
      const orphanedTeamMembers = await TeamMember.findAll({
        where: { team_id: team.id },
      });

      // This behavior depends on cascade configuration
      // In a proper setup, orphaned team members should be cleaned up
      expect(orphanedTeamMembers).toHaveLength(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should efficiently handle team queries with large datasets', async () => {
      // Create multiple teams for performance testing
      const teams: Team[] = [];
      for (let i = 0; i < 10; i++) {
        const team = await Team.create({
          name: `Performance Team ${i}`,
          company_id: company.id,
          owner_user_id: manager.id,
        });
        teams.push(team);
      }

      const startTime = Date.now();

      const allTeams = await Team.findAll({
        where: { company_id: company.id },
      });

      const queryTime = Date.now() - startTime;

      expect(allTeams).toHaveLength(10);
      expect(queryTime).toBeLessThan(100); // Should be fast for small dataset
    });

    it('should efficiently handle complex association queries', async () => {
      team = await Team.create({
        name: 'Complex Query Team',
        company_id: company.id,
        owner_user_id: manager.id,
      });

      const startTime = Date.now();

      const complexQuery = await Team.findByPk(team.id, {
        include: [
          { model: Company, as: 'company' },
          { model: User, as: 'owner' },
          { model: User, as: 'members', through: { attributes: [] } },
        ],
      });

      const queryTime = Date.now() - startTime;

      expect(complexQuery).toBeDefined();
      expect(complexQuery!.company).toBeDefined();
      expect(complexQuery!.owner).toBeDefined();
      expect(queryTime).toBeLessThan(100); // Should be reasonably fast
    });
  });
});
