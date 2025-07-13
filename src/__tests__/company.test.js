jest.mock('../middleware/token/tokenValidation', () => {
  return (req, res, next) => {
    req.userDecoded = { sub: 'auth0|testuser' }; // fake user
    next();
  };
});

const request = require('supertest');
const app = require('../app');
const db = require('../models');
const companyService = require('../services/company_service');
const CompanyControllerCodes = require('../controllers/company_controller/company_controller_codes');
const CompanyValidatorCodes = require('../middleware/company/companyValidatorCodes');
const RoleValidatorCodes = require('../middleware/role/roleValidatorCodes');
const { v4: uuidv4 } = require('uuid');

beforeAll(async () => {
  await db.sequelize.sync({ force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('POST /company', () => {
  let user;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    // Create a test user
    user = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'client',
      is_lawyer: false,
    });
  });

  afterAll(async () => {
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  beforeEach(async () => {
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 for invalid request payload', async () => {
    const response = await request(app)
      .post('/company')
      .set('Authorization', `Bearer TEST`)
      .send({});

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 if user already owns a company', async () => {
    // Create a company for the test user
    await companyService.createCompany({
      name: 'Existing Company',
      address: '123 Main St',
      email: 'existing@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    const response = await request(app).post('/company').set('Authorization', `Bearer TEST`).send({
      name: 'New Company',
      address: '456 Elm St',
      email: 'new@example.com',
      phoneNumber: '987-654-3210',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe(
      CompanyControllerCodes.CREATE_COMPANY_USER_ALREADY_OWNS_ERROR.code
    );
  });

  it('should create a new company successfully', async () => {
    console.log('Test');
    const response = await request(app).post('/company').set('Authorization', `Bearer TEST`).send({
      name: 'Test Company',
      address: '123 Main St',
      email: 'test@example.com',
      phoneNumber: '123-456-7890',
    });

    expect(response.statusCode).toBe(201);
    expect(response.body.code).toBe(CompanyControllerCodes.CREATE_COMPANY_SUCCESS.code);
    expect(response.body.payload.companyId).toBeDefined();

    // Verify company was created
    const company = await db.Company.findByPk(response.body.payload.companyId);
    expect(company).toBeTruthy();
    expect(company.owner_id).toBe(user.id);
  });
});

describe('GET /company', () => {
  let user;
  let company;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    // Create a test user
    user = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'client',
      is_lawyer: false,
    });

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'test@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    await db.User.update(
      { company_id: company.id, role: 'vendor_admin' },
      { where: { id: user.id } }
    );
    user.role = 'vendor_admin';
  });

  afterAll(async () => {
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 200 with company data', async () => {
    user;
    const response = await request(app).get('/company').set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(CompanyControllerCodes.GET_COMPANY_SUCCESS.code);
    expect(response.body.payload).toHaveProperty('id', company.id);
    expect(response.body.payload).toHaveProperty('name', 'Test Company');
    expect(response.body.payload.owner).toEqual({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      isLawyer: user.is_lawyer,
      companyId: company.id,
    });
  });

  it('should return 404 if no company exists', async () => {
    // Delete the test company
    await db.Company.destroy({ where: {} });

    const response = await request(app).get('/company').set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(404);
    expect(response.body.code).toBe(CompanyControllerCodes.COMPANY_NOT_FOUND.code);
  });
});

describe('GET /company/:companyId/users', () => {
  let user;
  let company;
  let testUsers;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    // Create a test user
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
      email: 'test@example.com',
      phone_number: '123-456-7890',
      owner_id: user.id,
    });

    await db.User.update(
      { company_id: company.id, role: 'vendor_admin' },
      { where: { id: user.id } }
    );

    user.company_id = company.id;

    // Create test users
    testUsers = await db.User.bulkCreate([
      {
        first_name: 'User1',
        last_name: 'Test',
        email: 'user1@example.com',
        auth0_user_id: 'auth0|user1',
        role: 'vendor_employee',
        is_lawyer: false,
        company_id: company.id,
      },
      {
        first_name: 'User2',
        last_name: 'Test',
        email: 'user2@example.com',
        auth0_user_id: 'auth0|user2',
        role: 'vendor_employee',
        is_lawyer: false,
        company_id: company.id,
      },
    ]);
  });

  afterAll(async () => {
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 200 with company users', async () => {
    const response = await request(app)
      .get(`/company/${company.id}/users?page=1&limit=10`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(CompanyControllerCodes.GET_USERS_SUCCESS.code);
    expect(response.body.payload.users).toHaveLength(3);

    // Check first user data structure
    const firstUser = response.body.payload.users[0];
    expect(firstUser).toEqual({
      id: expect.any(String),
      firstName: expect.any(String),
      lastName: expect.any(String),
      email: expect.any(String),
      role: expect.any(String),
      isLawyer: expect.any(Boolean),
      companyId: company.id,
      createdAt: expect.any(String),
    });
  });

  it('should return array with just owner when no users exist', async () => {
    // Delete all users
    await db.User.destroy({
      where: {
        role: 'vendor_employee',
      },
    });

    const response = await request(app)
      .get(`/company/${company.id}/users?page=1&limit=10`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.payload.users).toHaveLength(1);
  });

  it('should return 400 for invalid company ID', async () => {
    const response = await request(app)
      .get('/company/invalid-id/users?page=1&limit=10')
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /company/:companyId/users', () => {
  let adminUser;
  let otherAdminUser;
  let userToBeAdded;
  let company;
  let otherCompany;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    // Create the test users
    adminUser = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_admin',
      is_lawyer: false,
    });

    otherAdminUser = await db.User.create({
      first_name: 'Test3',
      last_name: 'User3',
      email: 'test3@example.com',
      auth0_user_id: 'auth0|testuser3',
      role: 'vendor_admin',
      is_lawyer: false,
    });

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'test@example.com',
      phone_number: '123-456-7890',
      owner_id: adminUser.id,
    });

    otherCompany = await db.Company.create({
      name: 'Test Company 2',
      address: '456 Main St',
      email: 'test@example2.com',
      phone_number: '999-999-9999',
      owner_id: otherAdminUser.id,
    });

    await db.User.update(
      { company_id: company.id, role: 'vendor_admin' },
      { where: { id: adminUser.id } }
    );
    await db.User.update(
      { company_id: otherCompany.id, role: 'vendor_admin' },
      { where: { id: otherAdminUser.id } }
    );

    userToBeAdded = await db.User.create({
      first_name: 'Test2',
      last_name: 'User2',
      email: 'test2@example.com',
      auth0_user_id: 'auth0|testuser2',
      role: 'client',
      is_lawyer: false,
      company_id: otherCompany.id,
    });

    adminUser.company_id = company.id;
    otherAdminUser.company_id = otherCompany.id;
  });

  afterAll(async () => {
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 with invalid companyId param', async () => {
    const response = await request(app)
      .post(`/company/invalid-id/users`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 with invalid userId in body', async () => {
    company;
    const response = await request(app)
      .post(`/company/${company.id}/users`)
      .send({
        userId: 1,
        role: 'vendor_employee',
        isLawyer: false,
      })
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 with invalid role in body', async () => {
    const response = await request(app)
      .post(`/company/${company.id}/users`)
      .send({
        userId: userToBeAdded.id,
        role: 1,
        isLawyer: false,
      })
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 with invalid isLawyer in body', async () => {
    const response = await request(app)
      .post(`/company/${company.id}/users`)
      .send({
        userId: userToBeAdded.id,
        role: 'vendor_employee',
        isLawyer: 'yes',
      })
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 id company does not exist', async () => {
    const response = await request(app)
      .post(`/company/3ff7b3de-a34c-49c5-bc0b-e84b8e2bf906/users`)
      .send({
        userId: userToBeAdded.id,
        role: 'vendor_employee',
        isLawyer: false,
      })
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(404);
  });

  it('should return 403 if user is not admin of company', async () => {
    await db.User.update({ role: 'vendor_employee' }, { where: { id: adminUser.id } });

    const response = await request(app)
      .post(`/company/${company.id}/users`)
      .send({
        userId: userToBeAdded.id,
        role: 'vendor_employee',
        isLawyer: false,
      })
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(403);
    await db.User.update({ role: 'vendor_admin' }, { where: { id: adminUser.id } });
  });

  it('should return 404 if user to be added does not exist', async () => {
    const response = await request(app)
      .post(`/company/${company.id}/users`)
      .send({
        userId: 'b5baf902-2c2c-4f5d-9d78-643d01754899',
        role: 'vendor_employee',
        isLawyer: false,
      })
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(404);
    expect(response.body.code).toBe(CompanyValidatorCodes.USER_NOT_FOUND.code);
  });

  it('should return 403 if user to be added is already in a company', async () => {
    const response = await request(app)
      .post(`/company/${company.id}/users`)
      .send({
        userId: userToBeAdded.id,
        role: 'vendor_employee',
        isLawyer: false,
      })
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(CompanyValidatorCodes.USER_IS_IN_A_COMPANY.code);
  });

  it('should return 200 when trying to add a user to a company', async () => {
    await db.User.update({ company_id: null }, { where: { id: userToBeAdded.id } });

    const response = await request(app)
      .post(`/company/${company.id}/users`)
      .send({
        userId: userToBeAdded.id,
        role: 'vendor_employee',
        isLawyer: false,
      })
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(CompanyControllerCodes.ADD_USER_TO_COMPANY_SUCCESS.code);
  });
});

describe('DELETE /company/:companyId/users/:userId', () => {
  let adminUser;
  let otherAdminUser;
  let userToBeRemoved;
  let company;
  let otherCompany;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    // Create the test users
    adminUser = await db.User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_admin',
      is_lawyer: false,
    });

    otherAdminUser = await db.User.create({
      first_name: 'Test3',
      last_name: 'User3',
      email: 'test3@example.com',
      auth0_user_id: 'auth0|testuser3',
      role: 'vendor_admin',
      is_lawyer: false,
    });

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'test@example.com',
      phone_number: '123-456-7890',
      owner_id: adminUser.id,
    });

    otherCompany = await db.Company.create({
      name: 'Test Company 2',
      address: '456 Main St',
      email: 'test@example2.com',
      phone_number: '999-999-9999',
      owner_id: otherAdminUser.id,
    });

    await db.User.update({ company_id: company.id }, { where: { id: adminUser.id } });
    await db.User.update({ company_id: otherCompany.id }, { where: { id: otherAdminUser.id } });

    userToBeRemoved = await db.User.create({
      first_name: 'Test2',
      last_name: 'User2',
      email: 'test2@example.com',
      auth0_user_id: 'auth0|testuser2',
      role: 'client',
      is_lawyer: false,
      company_id: company.id,
    });

    adminUser.company_id = company.id;
    otherAdminUser.company_id = otherCompany.id;
  });

  afterAll(async () => {
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 with invalid companyId param', async () => {
    const response = await request(app)
      .delete(`/company/invalid-id/users/${userToBeRemoved.id}}`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 with invalid userId in param', async () => {
    company;
    const response = await request(app)
      .delete(`/company/${company.id}/users/invalid-id`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 id company does not exist', async () => {
    const response = await request(app)
      .delete(`/company/3ff7b3de-a34c-49c5-bc0b-e84b8e2bf906/users/${userToBeRemoved.id}`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(404);
  });

  it('should return 403 if requesting user is not admin of company', async () => {
    await db.User.update({ role: 'vendor_employee' }, { where: { id: adminUser.id } });

    const response = await request(app)
      .delete(`/company/${company.id}/users/${userToBeRemoved.id}`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(403);
    await db.User.update({ role: 'vendor_admin' }, { where: { id: adminUser.id } });
  });

  it('should return 404 if user to be removed does not exist', async () => {
    const response = await request(app)
      .delete(`/company/${company.id}/users/b5baf902-2c2c-4f5d-9d78-643d01754899`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(404);
    expect(response.body.code).toBe(CompanyValidatorCodes.USER_NOT_FOUND.code);
  });

  it('should return 403 if user to be removed does not belong to company', async () => {
    await db.User.update({ company_id: otherCompany.id }, { where: { id: userToBeRemoved.id } });

    const response = await request(app)
      .delete(`/company/${company.id}/users/${userToBeRemoved.id}`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(CompanyValidatorCodes.USER_IS_NOT_IN_THIS_COMPANY.code);

    await db.User.update({ company_id: company.id }, { where: { id: userToBeRemoved.id } });
  });

  it('should return 200 when trying to remove a user from a company', async () => {
    company;
    const response = await request(app)
      .delete(`/company/${company.id}/users/${userToBeRemoved.id}`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(CompanyControllerCodes.REMOVE_USER_FROM_COMPANY_SUCCESS.code);
  });
});

describe('GET /company/:companyId/teams', () => {
  let adminUser;
  let regularUser;
  let company;
  let teams;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    adminUser = await db.User.create({
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_admin',
      is_lawyer: false,
    });

    regularUser = await db.User.create({
      first_name: 'Regular',
      last_name: 'User',
      email: 'regular@example.com',
      auth0_user_id: 'auth0|regularuser',
      role: 'vendor_employee',
      is_lawyer: false,
    });

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'company@example.com',
      phone_number: '123-456-7890',
      owner_id: adminUser.id,
    });

    await db.User.update(
      { company_id: company.id, role: 'vendor_admin' },
      { where: { id: adminUser.id } }
    );
    await db.User.update({ company_id: company.id }, { where: { id: regularUser.id } });

    // Create test teams
    teams = await Promise.all([
      db.Team.create({
        name: 'Team 1',
        company_id: company.id,
        manager_id: adminUser.id,
      }),
      db.Team.create({
        name: 'Team 2',
        company_id: company.id,
        manager_id: regularUser.id,
      }),
    ]);

    // Add team members
    await Promise.all([
      db.TeamMember.create({
        team_id: teams[0].id,
        user_id: adminUser.id,
      }),
      db.TeamMember.create({
        team_id: teams[0].id,
        user_id: regularUser.id,
      }),
      db.TeamMember.create({
        team_id: teams[1].id,
        user_id: regularUser.id,
      }),
    ]);
  });

  afterAll(async () => {
    await db.TeamMember.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Team.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 400 with invalid companyId param', async () => {
    const response = await request(app)
      .get('/company/invalid-id/teams')
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 if company does not exist', async () => {
    const response = await request(app)
      .get(`/company/${uuidv4()}/teams`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(404);
    expect(response.body.code).toBe(RoleValidatorCodes.COMPANY_NOT_FOUND.code);
  });

  it('should return 403 if user is not admin of company', async () => {
    // Create another company
    const otherCompany = await db.Company.create({
      name: 'Other Company',
      address: '456 Other St',
      email: 'other@example.com',
      phone_number: '987-654-3210',
      owner_id: regularUser.id,
    });

    const response = await request(app)
      .get(`/company/${otherCompany.id}/teams`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(RoleValidatorCodes.USER_NOT_ADMIN_OF_COMPANY.code);
  });

  it('should return 403 if user is not admin', async () => {
    await db.User.update({ role: 'vendor_employee' }, { where: { id: adminUser.id } });

    const response = await request(app)
      .get(`/company/${company.id}/teams`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(RoleValidatorCodes.USER_NOT_ADMIN_OF_COMPANY.code);

    // Reset admin role
    await db.User.update({ role: 'vendor_admin' }, { where: { id: adminUser.id } });
  });

  it('should return 200 with company teams', async () => {
    const response = await request(app)
      .get(`/company/${company.id}/teams`)
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(CompanyControllerCodes.GET_TEAMS_SUCCESS.code);
    expect(response.body.payload.teams).toHaveLength(2);

    // Verify team data structure
    const team = response.body.payload.teams[0];
    expect(team).toHaveProperty('id');
    expect(team).toHaveProperty('name');
    expect(team).toHaveProperty('manager');
    expect(team).toHaveProperty('members');
    expect(Array.isArray(team.members)).toBe(true);
  });
});

describe('GET /company/users/search', () => {
  let adminUser;
  let company;
  let searchableUsers;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    adminUser = await db.User.create({
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      auth0_user_id: 'auth0|testuser',
      role: 'vendor_admin',
      is_lawyer: false,
    });

    company = await db.Company.create({
      name: 'Test Company',
      address: '123 Main St',
      email: 'company@example.com',
      phone_number: '123-456-7890',
      owner_id: adminUser.id,
    });

    await db.User.update({ company_id: company.id }, { where: { id: adminUser.id } });

    // Create searchable users
    searchableUsers = await Promise.all([
      db.User.create({
        first_name: 'John',
        last_name: 'Smith',
        email: 'john@example.com',
        auth0_user_id: 'auth0|john',
        role: 'vendor_employee',
        is_lawyer: true,
        company_id: company.id,
      }),
      db.User.create({
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        auth0_user_id: 'auth0|jane',
        role: 'vendor_manager',
        is_lawyer: false,
        company_id: company.id,
      }),
    ]);
  });

  afterAll(async () => {
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
  });

  it('should return 403 if user is not admin', async () => {
    await db.User.update({ role: 'vendor_employee' }, { where: { id: adminUser.id } });

    const response = await request(app)
      .get('/company/users/search')
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(RoleValidatorCodes.USER_NOT_ADMIN_OF_COMPANY.code);

    // Reset user role
    await db.User.update({ role: 'vendor_admin' }, { where: { id: adminUser.id } });
  });

  it('should return matching users by name search', async () => {
    const response = await request(app)
      .get('/company/users/search?searchValue=smith')
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(CompanyControllerCodes.SEARCH_USERS_SUCCESS.code);
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

  it('should filter users by isLawyer', async () => {
    const response = await request(app)
      .get('/company/users/search?isLawyer=true')
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.payload.users).toHaveLength(1);
    expect(response.body.payload.users[0].isLawyer).toBe(true);
  });

  it('should combine search and filters', async () => {
    const response = await request(app)
      .get('/company/users/search?searchValue=smith&role=employee&isLawyer=true')
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.payload.users).toHaveLength(1);
    expect(response.body.payload.users[0]).toEqual({
      id: searchableUsers[0].id,
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      role: 'vendor_employee',
      isLawyer: true,
      companyId: company.id,
    });
  });

  it('should filter users by multiple roles', async () => {
    // Create additional users with different roles
    const additionalUsers = await Promise.all([
      db.User.create({
        first_name: 'Admin',
        last_name: 'User',
        email: 'admin2@example.com',
        auth0_user_id: 'auth0|admin2',
        role: 'vendor_admin',
        is_lawyer: false,
        company_id: company.id,
      }),
      db.User.create({
        first_name: 'Manager',
        last_name: 'User',
        email: 'manager2@example.com',
        auth0_user_id: 'auth0|manager2',
        role: 'vendor_manager',
        is_lawyer: false,
        company_id: company.id,
      }),
    ]);

    const response = await request(app)
      .get('/company/users/search')
      .query({ roles: ['manager', 'admin'] })
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(CompanyControllerCodes.SEARCH_USERS_SUCCESS.code);

    // Should find all managers and admins (4 users: 2 from additionalUsers + 2 from searchableUsers)
    expect(response.body.payload.users).toHaveLength(4);

    // Verify roles are either manager or admin
    expect(
      response.body.payload.users.every(
        (user) => user.role.includes('_manager') || user.role.includes('_admin')
      )
    ).toBe(true);
  });

  it('should combine multiple roles with other filters', async () => {
    // Create a lawyer admin
    await db.User.create({
      first_name: 'Lawyer',
      last_name: 'Admin',
      email: 'lawyer.admin@example.com',
      auth0_user_id: 'auth0|lawyeradmin',
      role: 'vendor_admin',
      is_lawyer: true,
      company_id: company.id,
    });

    company;
    const response = await request(app)
      .get('/company/users/search')
      .query({
        roles: ['manager', 'admin'],
        isLawyer: true,
      })
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    // Should find 1 user: Lawyer Admin (only admin that is a lawyer)
    expect(response.body.payload.users).toHaveLength(1);
    expect(response.body.payload.users.every((user) => user.isLawyer)).toBe(true);
    expect(
      response.body.payload.users.some((user) =>
        [
          'vendor_admin',
          'vendor_manager',
          'national_niner_admin',
          'national_niner_manager',
        ].includes(user.role)
      )
    ).toBe(true);
  });

  it('should handle empty roles array', async () => {
    const response = await request(app)
      .get('/company/users/search')
      .query({ roles: [] }) // Let supertest handle the empty array
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(200);
    // Should return all users since no role filter is effectively applied
    expect(response.body.payload.users.length).toBeGreaterThan(0);
  });

  it('should handle invalid role values', async () => {
    const response = await request(app)
      .get('/company/users/search?roles[]=invalid_role')
      .set('Authorization', `Bearer TEST`);

    expect(response.statusCode).toBe(400);
  });
});
