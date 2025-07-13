import { Team } from '../../src/modules/team/entities/team.entity';
import { TeamMember } from '../../src/modules/team/entities/team-member.entity';

let teamCounter = 1;

export interface CreateTeamOptions {
  name?: string;
  company_id?: string;
  owner_user_id?: string;
}

export const createTestTeam = async (
  companyId: string,
  options: CreateTeamOptions = {}
): Promise<Team> => {
  // If no owner_user_id provided, we need to create a user to be the owner
  let ownerId = options.owner_user_id;

  if (!ownerId) {
    // Import the user factory dynamically to avoid circular imports
    const { createTestUser } = await import('./user.factory');
    const owner = await createTestUser(companyId);
    ownerId = owner.id;
  }

  const defaults = {
    name: `Test Team ${teamCounter++}`,
  };

  // Ensure owner_user_id and company_id are explicitly set
  const teamData = {
    ...defaults,
    ...options,
    company_id: companyId,
    owner_user_id: ownerId,
  };

  return await Team.create(teamData);
};

export interface CreateTeamMemberOptions {
  role?: string;
}

export const createTestTeamMember = async (
  teamId: string,
  userId: string,
  options: CreateTeamMemberOptions = {}
): Promise<TeamMember> => {
  const defaults = {
    role: 'member',
  };

  const memberData = {
    ...defaults,
    ...options,
    team_id: teamId,
    user_id: userId,
  };

  return await TeamMember.create(memberData);
};

export const createTestTeamWithMembers = async (
  companyId: string,
  userIds: string[],
  teamOptions: CreateTeamOptions = {},
  memberOptions: CreateTeamMemberOptions = {}
): Promise<{ team: Team; members: TeamMember[] }> => {
  const team = await createTestTeam(companyId, teamOptions);

  const members: TeamMember[] = [];
  for (const userId of userIds) {
    const member = await createTestTeamMember(team.id, userId, memberOptions);
    members.push(member);
  }

  return { team, members };
};
