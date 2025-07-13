jest.mock('../middleware/token/tokenValidation', () => {
  return (req, res, next) => {
    req.userDecoded = { sub: 'auth0|testuser' };
    next();
  };
});

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../app');
const db = require('../models');
const RoleControllerCodes = require('../controllers/role_controller/role_controller_codes');
const RoleValidatorCodes = require('../middleware/role/roleValidatorCodes');

describe('PUT /role/:userId', () => {
  let adminUser;
  let regularUser;
  let company;

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

    await db.User.update({ company_id: company.id }, { where: { id: adminUser.id } });
    await db.User.update({ company_id: company.id }, { where: { id: regularUser.id } });
  });

  afterAll(async () => {
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.Company.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.sequelize.close();
  });

  it('should return 400 with invalid userId param', async () => {
    const response = await request(app)
      .put('/role/invalid-id')
      .set('Authorization', `Bearer TEST`)
      .send({ role: 'vendor_manager' });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 with invalid role', async () => {
    const response = await request(app)
      .put(`/role/${regularUser.id}`)
      .set('Authorization', `Bearer TEST`)
      .send({ role: 'invalid_role' });

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 if user does not exist', async () => {
    const response = await request(app)
      .put(`/role/${uuidv4()}`)
      .set('Authorization', `Bearer TEST`)
      .send({ role: 'vendor_manager' });

    expect(response.statusCode).toBe(404);
    expect(response.body.code).toBe(RoleValidatorCodes.USER_NOT_FOUND.code);
  });

  it('should return 403 if requesting user is not admin', async () => {
    await db.User.update({ role: 'vendor_employee' }, { where: { id: adminUser.id } });

    const response = await request(app)
      .put(`/role/${regularUser.id}`)
      .set('Authorization', `Bearer TEST`)
      .send({ role: 'vendor_manager' });

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe(RoleValidatorCodes.USER_IS_NOT_ADMIN.code);

    // Reset admin role
    await db.User.update({ role: 'vendor_admin' }, { where: { id: adminUser.id } });
  });

  it('should return 200 when admin updates user role', async () => {
    const response = await request(app)
      .put(`/role/${regularUser.id}`)
      .set('Authorization', `Bearer TEST`)
      .send({ role: 'vendor_manager' });

    expect(response.statusCode).toBe(200);
    expect(response.body.code).toBe(RoleControllerCodes.UPDATE_ROLE_SUCCESS.code);

    // Verify role was updated
    const updatedUser = await db.User.findByPk(regularUser.id);
    expect(updatedUser.role).toBe('vendor_manager');
  });
});
