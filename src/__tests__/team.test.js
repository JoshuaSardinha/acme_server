const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../app');
const db = require('../models');
const TeamControllerCodes = require('../controllers/team_controller/team_controller_codes');
const TeamValidatorCodes = require('../middleware/team/teamValidatorCodes');

jest.mock('../middleware/token/tokenValidation', () => {
  return (req, res, next) => {
    req.userDecoded = { sub: 'auth0|testuser' }; // fake user
    next();
  };
});

beforeAll(async () => {
  await db.sequelize.sync({ force: true });
  await db.TeamMember.destroy({ where: {}, cascade: true, restartIdentity: true });
  await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
  await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
  await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
});

afterAll(async () => {
  await db.TeamMember.destroy({ where: {}, cascade: true, restartIdentity: true });
  await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
  await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
  await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  await db.sequelize.close();
});

describe('POST /team', () => {
  let user;
  let company;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    // Create a test user and company
    user = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_manager',
      is_lawyer: false,
    });

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'company@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    await db.User.update({ company_id: company.id }, { where: { id: user.id } });
  });

  afterAll(async () => {
    await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  beforeEach(async () => {
    await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 for invalid request payload', async () => {
    const response = await request(app).post('/team').set('Authorization', `Bearer TEST`).send({});

    expect(response.statusCode).toBe(400);
  });

  it('should create a new team successfully', async () => {
    const response = await request(app)
      .post('/team')
      .set('Authorization', `Bearer TEST`)
      .send({
        name: 'Test Team',
        managerId: user.id,
        users: [user.id],
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.code).toBe(TeamControllerCodes.CREATE_TEAM_SUCCESS.code);
    expect(response.body.payload.teamId).toBeDefined();

    // Verify team was created
    const team = await db.Team.findByPk(response.body.payload.teamId);
    expect(team).toBeTruthy();
    expect(team.manager_id).toBe(user.id);
  });
});

describe('GET /team', () => {
  let user;
  let company;
  let team;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    user = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_manager',
      is_lawyer: false,
    });

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'company@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    await db.User.update({ company_id: company.id }, { where: { id: user.id } });

    team = await db.Team.create({
      name: 'Test Team',
      company_id: company.id,
      manager_id: user.id,
    });

    await db.TeamMember.create({
      team_id: team.id,
      user_id: user.id,
    });
  });

  afterAll(async () => {
    await db.TeamMember.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 200 with user teams', async () => {
    const response = await request(app).get('/team').set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(TeamControllerCodes.GET_TEAM_SUCCESS.code);
    expect(response.body.payload.teams).toHaveLength(1);

    const team = response.body.payload.teams[0];
    expect(team).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      manager: {
        id: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        email: expect.any(String),
        role: expect.any(String),
      },
      company: {
        id: expect.any(String),
        name: expect.any(String),
        address: expect.any(String),
        email: expect.any(String),
        phoneNumber: expect.any(String),
        owner: {
          id: expect.any(String),
          firstName: expect.any(String),
          lastName: expect.any(String),
          email: expect.any(String),
          role: expect.any(String),
        },
      },
      members: expect.any(Array),
    });
  });
});

describe('GET /team/:teamId/users', () => {
  let user;
  let company;
  let team;
  let teamMember;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    user = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_manager',
      is_lawyer: false,
    });

    teamMember = await db.User.create({
      first_name: 'Team',
      last_name: 'Member',
      email: 'member@example.com',
      auth0_user_id: 'auth0|member',
      role: 'vendor_employee',
      is_lawyer: false,
    });

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'company@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    await db.User.update({ company_id: company.id }, { where: { id: user.id } });
    await db.User.update({ company_id: company.id }, { where: { id: teamMember.id } });

    team = await db.Team.create({
      name: 'Test Team',
      company_id: company.id,
      manager_id: user.id,
    });

    await db.TeamMember.create({
      team_id: team.id,
      user_id: user.id,
    });

    await db.TeamMember.create({
      team_id: team.id,
      user_id: teamMember.id,
    });
  });

  afterAll(async () => {
    await db.TeamMember.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 with invalid teamId param', async () => {
    const response = await request(app)
      .get('/team/invalid-id/users')
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });

  it('should return 403 if user is not part of team', async () => {
    const otherTeam = await db.Team.create({
      name: 'Other Team',
      company_id: company.id,
      manager_id: teamMember.id,
    });

    const response = await request(app)
      .get(`/team/${otherTeam.id}/users`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(TeamValidatorCodes.USER_IS_NOT_IN_THIS_TEAM.code);
  });

  it('should return 200 with team users', async () => {
    const response = await request(app)
      .get(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(TeamControllerCodes.GET_USERS_SUCCESS.code);
    expect(response.body.payload.users).toHaveLength(2);

    const firstUser = response.body.payload.users[0];
    expect(firstUser).toEqual({
      id: expect.any(String),
      firstName: expect.any(String),
      lastName: expect.any(String),
      email: expect.any(String),
      role: expect.any(String),
      isLawyer: expect.any(Boolean),
      companyId: company.id,
    });
  });
});

describe('POST /team/:teamId/users', () => {
  let user;
  let company;
  let team;
  let usersToBeAdded;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    user = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_manager',
      is_lawyer: false,
    });

    // Create multiple users to be added
    usersToBeAdded = await Promise.all([
      db.User.create({
        first_name: 'New1',
        last_name: 'Member1',
        email: 'new1@example.com',
        auth0_user_id: 'auth0|newmember1',
        role: 'vendor_employee',
        is_lawyer: false,
      }),
      db.User.create({
        first_name: 'New2',
        last_name: 'Member2',
        email: 'new2@example.com',
        auth0_user_id: 'auth0|newmember2',
        role: 'vendor_employee',
        is_lawyer: false,
      }),
    ]);

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'company@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    await db.User.update({ company_id: company.id }, { where: { id: user.id } });
    await Promise.all(
      usersToBeAdded.map((u) => db.User.update({ company_id: company.id }, { where: { id: u.id } }))
    );

    team = await db.Team.create({
      name: 'Test Team',
      company_id: company.id,
      manager_id: user.id,
    });

    await db.TeamMember.create({
      team_id: team.id,
      user_id: user.id,
    });
  });

  afterAll(async () => {
    await db.TeamMember.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 with invalid teamId param', async () => {
    const response = await request(app)
      .post('/team/invalid-id/users')
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: [usersToBeAdded[0].id] });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 with invalid userIds in body', async () => {
    const response = await request(app)
      .post(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: ['invalid-id'] });

    expect(response.statusCode).toBe(400);
  });

  it('should return 403 if user is not manager or admin', async () => {
    await db.User.update({ role: 'vendor_employee' }, { where: { id: user.id } });

    const response = await request(app)
      .post(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: usersToBeAdded.map((u) => u.id) });

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(TeamValidatorCodes.USER_IS_NOT_ADMIN_OR_MANAGER.code);

    // Reset user role
    await db.User.update({ role: 'vendor_manager' }, { where: { id: user.id } });
  });

  it('should return 200 when adding multiple users to team', async () => {
    const response = await request(app)
      .post(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: usersToBeAdded.map((u) => u.id) });

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(TeamControllerCodes.ADD_USER_TO_TEAM_SUCCESS.code);
    expect(response.body.payload.teamMembers).toHaveLength(2);

    // Verify users were added to team
    const teamMembers = await db.TeamMember.findAll({
      where: { team_id: team.id, user_id: usersToBeAdded.map((u) => u.id) },
    });
    expect(teamMembers).toHaveLength(2);
  });
});

describe('DELETE /team/:teamId/users', () => {
  let user;
  let company;
  let team;
  let usersToBeRemoved;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    user = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_manager',
      is_lawyer: false,
    });

    usersToBeRemoved = await Promise.all([
      db.User.create({
        first_name: 'Remove1',
        last_name: 'Member1',
        email: 'remove1@example.com',
        auth0_user_id: 'auth0|removemember1',
        role: 'vendor_employee',
        is_lawyer: false,
      }),
      db.User.create({
        first_name: 'Remove2',
        last_name: 'Member2',
        email: 'remove2@example.com',
        auth0_user_id: 'auth0|removemember2',
        role: 'vendor_employee',
        is_lawyer: false,
      }),
    ]);

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'company@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    await db.User.update({ company_id: company.id }, { where: { id: user.id } });
    await Promise.all(
      usersToBeRemoved.map((u) =>
        db.User.update({ company_id: company.id }, { where: { id: u.id } })
      )
    );

    team = await db.Team.create({
      name: 'Test Team',
      company_id: company.id,
      manager_id: user.id,
    });

    // Add all users to the team
    await Promise.all([
      db.TeamMember.create({
        team_id: team.id,
        user_id: user.id,
      }),
      ...usersToBeRemoved.map((u) =>
        db.TeamMember.create({
          team_id: team.id,
          user_id: u.id,
        })
      ),
    ]);
  });

  afterAll(async () => {
    await db.TeamMember.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 with invalid teamId param', async () => {
    const response = await request(app)
      .delete('/team/invalid-id/users')
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: [usersToBeRemoved[0].id] });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 with invalid userIds in body', async () => {
    const response = await request(app)
      .delete(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: ['invalid-id'] });

    expect(response.statusCode).toBe(400);
  });

  it('should return 403 if user is not manager or admin', async () => {
    await db.User.update({ role: 'vendor_employee' }, { where: { id: user.id } });

    const response = await request(app)
      .delete(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: usersToBeRemoved.map((u) => u.id) });

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(TeamValidatorCodes.USER_IS_NOT_ADMIN_OR_MANAGER.code);

    // Reset user role
    await db.User.update({ role: 'vendor_manager' }, { where: { id: user.id } });
  });

  it('should return 200 when removing multiple users from team', async () => {
    const response = await request(app)
      .delete(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: usersToBeRemoved.map((u) => u.id) });

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(TeamControllerCodes.REMOVE_USER_FROM_TEAM_SUCCESS.code);

    // Verify users were removed from team
    const teamMembers = await db.TeamMember.findAll({
      where: { team_id: team.id, user_id: usersToBeRemoved.map((u) => u.id) },
    });
    expect(teamMembers).toHaveLength(0);
  });
});

describe('DELETE /team/:teamId', () => {
  let user;
  let company;
  let team;
  let teamMember;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    user = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_manager',
      is_lawyer: false,
    });

    teamMember = await db.User.create({
      first_name: 'Team',
      last_name: 'Member',
      email: 'member@example.com',
      auth0_user_id: 'auth0|member',
      role: 'vendor_employee',
      is_lawyer: false,
    });

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'company@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    await db.User.update({ company_id: company.id }, { where: { id: user.id } });
    await db.User.update({ company_id: company.id }, { where: { id: teamMember.id } });

    team = await db.Team.create({
      name: 'Test Team',
      company_id: company.id,
      manager_id: user.id,
    });

    await db.TeamMember.create({
      team_id: team.id,
      user_id: user.id,
    });

    await db.TeamMember.create({
      team_id: team.id,
      user_id: teamMember.id,
    });
  });

  afterAll(async () => {
    await db.TeamMember.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 with invalid teamId param', async () => {
    const response = await request(app)
      .delete('/team/invalid-id')
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 if team does not exist', async () => {
    const response = await request(app)
      .delete(`/team/${uuidv4()}`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(404);
    expect(response.body.code).toBe(TeamValidatorCodes.TEAM_NOT_FOUND.code);
  });

  it('should return 403 if user is not team manager or admin', async () => {
    // Update user role to employee and create new team
    await db.User.update({ role: 'vendor_employee' }, { where: { id: user.id } });
    const otherTeam = await db.Team.create({
      name: 'Other Team',
      company_id: company.id,
      manager_id: teamMember.id,
    });

    const response = await request(app)
      .delete(`/team/${otherTeam.id}`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(TeamValidatorCodes.USER_IS_NOT_TEAM_MANAGER_OR_ADMIN.code);

    // Reset user role
    await db.User.update({ role: 'vendor_manager' }, { where: { id: user.id } });
  });

  it('should return 200 when team manager deletes team', async () => {
    const response = await request(app)
      .delete(`/team/${team.id}`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(TeamControllerCodes.DELETE_TEAM_SUCCESS.code);

    // Verify team was deleted
    const deletedTeam = await db.Team.findByPk(team.id);
    expect(deletedTeam).toBeFalsy();
  });

  it('should return 200 when company admin deletes team', async () => {
    // Create new team and set user as admin
    const newTeam = await db.Team.create({
      name: 'New Team',
      company_id: company.id,
      manager_id: teamMember.id,
    });
    await db.User.update({ role: 'vendor_admin' }, { where: { id: user.id } });

    const response = await request(app)
      .delete(`/team/${newTeam.id}`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(TeamControllerCodes.DELETE_TEAM_SUCCESS.code);

    // Verify team was deleted
    const deletedTeam = await db.Team.findByPk(newTeam.id);
    expect(deletedTeam).toBeFalsy();
  });
});

describe('GET /team/:teamId/users/search', () => {
  let user;
  let company;
  let team;
  let searchableUsers;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    user = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_manager',
      is_lawyer: false,
    });

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'company@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    await db.User.update({ company_id: company.id }, { where: { id: user.id } });

    team = await db.Team.create({
      name: 'Test Team',
      company_id: company.id,
      manager_id: user.id,
    });

    await db.TeamMember.create({
      team_id: team.id,
      user_id: user.id,
    });

    // Create searchable users
    searchableUsers = await Promise.all([
      db.User.create({
        first_name: 'John',
        last_name: 'Smith',
        email: 'john@example.com',
        auth0_user_id: 'auth0|john',
        role: 'vendor_employee',
        is_lawyer: false,
        company_id: company.id,
      }),
      db.User.create({
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        auth0_user_id: 'auth0|jane',
        role: 'vendor_employee',
        is_lawyer: false,
        company_id: company.id,
      }),
    ]);
  });

  afterAll(async () => {
    await db.TeamMember.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 with invalid teamId param', async () => {
    const response = await request(app)
      .get('/team/invalid-id/users/search?searchValue=john')
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 with empty search value', async () => {
    const response = await request(app)
      .get(`/team/${team.id}/users/search`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe(TeamControllerCodes.SEARCH_USERS_VALIDATION_ERROR.code);
  });

  it('should return matching users not in team', async () => {
    const response = await request(app)
      .get(`/team/${team.id}/users/search?searchValue=smith`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(TeamControllerCodes.SEARCH_USERS_SUCCESS.code);
    expect(response.body.payload.users).toHaveLength(2);

    const firstUser = response.body.payload.users[0];
    expect(firstUser).toEqual({
      id: expect.any(String),
      firstName: expect.any(String),
      lastName: 'Smith',
      email: expect.any(String),
      role: expect.any(String),
      isLawyer: expect.any(Boolean),
      companyId: company.id,
    });
  });

  it('should not return users already in team', async () => {
    // Add one user to the team
    await db.TeamMember.create({
      team_id: team.id,
      user_id: searchableUsers[0].id,
    });

    const response = await request(app)
      .get(`/team/${team.id}/users/search?searchValue=smith`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.payload.users).toHaveLength(1);
    expect(response.body.payload.users[0].id).toBe(searchableUsers[1].id);
  });
});

describe('PUT /team/:teamId/manager', () => {
  let user;
  let company;
  let team;
  let newManager;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    user = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_admin',
      is_lawyer: false,
    });

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'company@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    await db.User.update({ company_id: company.id }, { where: { id: user.id } });

    newManager = await db.User.create({
      first_name: 'New',
      last_name: 'Manager',
      email: 'manager@example.com',
      auth0_user_id: 'auth0|manager',
      role: 'vendor_employee',
      is_lawyer: false,
      company_id: company.id,
    });

    team = await db.Team.create({
      name: 'Test Team',
      company_id: company.id,
      manager_id: user.id,
    });
  });

  afterAll(async () => {
    await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 with invalid teamId', async () => {
    const response = await request(app)
      .put('/team/invalid-id/manager')
      .set('Authorization', `Bearer TEST`)
      .send({ userId: newManager.id });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 with invalid userId', async () => {
    const response = await request(app)
      .put(`/team/${team.id}/manager`)
      .set('Authorization', `Bearer TEST`)
      .send({ userId: 'invalid-id' });

    expect(response.statusCode).toBe(400);
  });

  it('should return 403 if user is not admin', async () => {
    await db.User.update({ role: 'vendor_employee' }, { where: { id: user.id } });

    const response = await request(app)
      .put(`/team/${team.id}/manager`)
      .set('Authorization', `Bearer TEST`)
      .send({ userId: newManager.id });

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(TeamValidatorCodes.USER_NOT_ADMIN.code);

    // Reset user role
    await db.User.update({ role: 'vendor_admin' }, { where: { id: user.id } });
  });

  it('should return 404 if new manager does not exist', async () => {
    const response = await request(app)
      .put(`/team/${team.id}/manager`)
      .set('Authorization', `Bearer TEST`)
      .send({ userId: uuidv4() });

    expect(response.statusCode).toBe(404);
    expect(response.body.code).toBe(TeamValidatorCodes.USER_NOT_FOUND.code);
  });

  it('should return 403 if new manager is from different company', async () => {
    const otherCompany = await db.Company.create({
      name: 'Other Company',
      address: '456 Other St',
      email: 'other@example.com',
      phone_number: '987-654-3210',
    });

    const otherManager = await db.User.create({
      first_name: 'Other',
      last_name: 'Manager',
      email: 'other@example.com',
      auth0_user_id: 'auth0|other',
      role: 'vendor_employee',
      is_lawyer: false,
      company_id: otherCompany.id,
    });

    otherManager;
    const response = await request(app)
      .put(`/team/${team.id}/manager`)
      .set('Authorization', `Bearer TEST`)
      .send({ userId: otherManager.id });

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(TeamValidatorCodes.USER_NOT_FROM_COMPANY.code);
  });

  it('should return 200 when changing team manager', async () => {
    user;
    const response = await request(app)
      .put(`/team/${team.id}/manager`)
      .set('Authorization', `Bearer TEST`)
      .send({ userId: newManager.id });

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(TeamControllerCodes.CHANGE_MANAGER_SUCCESS.code);

    // Verify manager was changed
    const updatedTeam = await db.Team.findByPk(team.id);
    expect(updatedTeam.manager_id).toBe(newManager.id);
  });
});

describe('PUT /team/:teamId/users', () => {
  let user;
  let company;
  let team;
  let existingTeamMembers;
  let newTeamMembers;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    // Create test user (manager)
    user = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_manager',
      is_lawyer: false,
    });

    // Create test company
    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'company@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    await db.User.update({ company_id: company.id }, { where: { id: user.id } });

    // Create existing team members
    existingTeamMembers = await Promise.all([
      db.User.create({
        first_name: 'Existing1',
        last_name: 'Member1',
        email: 'existing1@example.com',
        auth0_user_id: 'auth0|existing1',
        role: 'vendor_employee',
        is_lawyer: false,
        company_id: company.id,
      }),
      db.User.create({
        first_name: 'Existing2',
        last_name: 'Member2',
        email: 'existing2@example.com',
        auth0_user_id: 'auth0|existing2',
        role: 'vendor_employee',
        is_lawyer: false,
        company_id: company.id,
      }),
    ]);

    // Create new team members
    newTeamMembers = await Promise.all([
      db.User.create({
        first_name: 'New1',
        last_name: 'Member1',
        email: 'new1@example.com',
        auth0_user_id: 'auth0|new1',
        role: 'vendor_employee',
        is_lawyer: false,
        company_id: company.id,
      }),
      db.User.create({
        first_name: 'New2',
        last_name: 'Member2',
        email: 'new2@example.com',
        auth0_user_id: 'auth0|new2',
        role: 'vendor_employee',
        is_lawyer: false,
        company_id: company.id,
      }),
    ]);

    // Create team
    team = await db.Team.create({
      name: 'Test Team',
      company_id: company.id,
      manager_id: user.id,
    });

    // Add existing members to team
    await Promise.all(
      existingTeamMembers.map((member) =>
        db.TeamMember.create({
          team_id: team.id,
          user_id: member.id,
        })
      )
    );
  });

  afterAll(async () => {
    await db.TeamMember.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 with invalid teamId param', async () => {
    const response = await request(app)
      .put('/team/invalid-id/users')
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: [newTeamMembers[0].id] });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 with empty userIds array', async () => {
    const response = await request(app)
      .put(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: [] });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('INVALID_USER_IDS');
  });

  it('should return 403 if user is not manager or admin', async () => {
    // Update user role to employee
    await db.User.update({ role: 'vendor_employee' }, { where: { id: user.id } });

    const response = await request(app)
      .put(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: newTeamMembers.map((u) => u.id) });

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe('USER_IS_NOT_ADMIN_OR_MANAGER');

    // Reset user role
    await db.User.update({ role: 'vendor_manager' }, { where: { id: user.id } });
  });

  it('should return 404 if any user in userIds does not exist', async () => {
    const response = await request(app)
      .put(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: [...newTeamMembers.map((u) => u.id), uuidv4()] });

    expect(response.statusCode).toBe(404);
    expect(response.body.code).toBe('USER_NOT_FOUND');
  });

  it('should return 403 if any user is from different company', async () => {
    // Create user from different company
    const otherCompany = await db.Company.create({
      name: 'Other Company',
      address: '456 Other St',
      email: 'other@example.com',
      phone_number: '987-654-3210',
    });

    const otherUser = await db.User.create({
      first_name: 'Other',
      last_name: 'User',
      email: 'other@example.com',
      auth0_user_id: 'auth0|other',
      role: 'vendor_employee',
      is_lawyer: false,
      company_id: otherCompany.id,
    });

    const response = await request(app)
      .put(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: [...newTeamMembers.map((u) => u.id), otherUser.id] });

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe('USER_NOT_FROM_COMPANY');
  });

  it('should successfully replace team members', async () => {
    const response = await request(app)
      .put(`/team/${team.id}/users`)
      .set('Authorization', `Bearer TEST`)
      .send({ userIds: newTeamMembers.map((u) => u.id) });

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe('REPLACE_USERS_SUCCESS');

    // Verify old members are removed
    const oldMemberCount = await db.TeamMember.count({
      where: {
        team_id: team.id,
        user_id: existingTeamMembers.map((u) => u.id),
      },
    });
    expect(oldMemberCount).toBe(0);

    // Verify new members are added
    const newMemberCount = await db.TeamMember.count({
      where: {
        team_id: team.id,
        user_id: newTeamMembers.map((u) => u.id),
      },
    });
    expect(newMemberCount).toBe(newTeamMembers.length);
  });
});
