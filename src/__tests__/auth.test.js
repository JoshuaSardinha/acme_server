jest.mock('../middleware/token/tokenValidation', () => {
  return (req, res, next) => {
    req.userDecoded = { sub: 'auth0|testuser' };
    next();
  };
});

jest.mock('axios');
const axios = require('axios');
const request = require('supertest');
const app = require('../app');
const db = require('../models');
const AuthControllerCodes = require('../controllers/auth_controller/auth_controller_codes');

describe('Auth Routes', () => {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await db.User.destroy({ where: {}, cascade: true, restartIdentity: true });
    await db.sequelize.close();
  });

  describe('POST /auth/signup', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const validSignupData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'Password123!',
    };

    it('should return 400 with invalid request payload', async () => {
      const response = await request(app).post('/auth/signup').send({});

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 400 with weak password', async () => {
      axios.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            message: 'PasswordStrengthError: Password is too weak',
          },
        },
      });

      const response = await request(app)
        .post('/auth/signup')
        .send({ ...validSignupData, password: '12345678' });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 if email already exists', async () => {
      // First call - successful signup
      axios.post.mockImplementationOnce(() =>
        Promise.resolve({
          data: { user_id: 'auth0|testuser' },
        })
      );

      // Create first user
      await request(app).post('/auth/signup').send(validSignupData);

      // Second call - simulate Auth0 conflict error
      axios.post.mockImplementationOnce(() =>
        Promise.reject({
          response: {
            status: 409,
            data: {
              message: 'The user already exists.',
              statusCode: 409,
            },
          },
        })
      );

      const response = await request(app).post('/auth/signup').send(validSignupData);

      expect(response.statusCode).toBe(400);
      expect(response.body.code).toBe(AuthControllerCodes.EMAIL_EXISTS.code);
    });

    it('should return 201 with valid signup data', async () => {
      // Mock the management token request
      axios.post.mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            access_token: 'mock_token',
            expires_in: 86400,
          },
        })
      );

      // Mock the user creation request
      axios.post.mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            user_id: 'auth0|testuser2',
            email: 'unique@example.com',
            user_metadata: {
              firstName: 'John',
              lastName: 'Doe',
            },
          },
        })
      );

      const response = await request(app)
        .post('/auth/signup')
        .send({
          ...validSignupData,
          email: 'unique@example.com',
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.code).toBe(AuthControllerCodes.SIGNUP_SUCCESS.code);
      expect(response.body.payload).toHaveProperty('id');
      expect(response.body.payload).toHaveProperty('auth0Id');
      expect(response.body.payload).toHaveProperty('email');
    });
  });

  describe('GET /auth/user', () => {
    let user;

    beforeAll(async () => {
      user = await db.User.create({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        auth0_user_id: 'auth0|testuser',
        role: 'client',
      });
    });

    it('should return 200 with user data', async () => {
      const response = await request(app)
        .get('/auth/user')
        .set('Authorization', 'Bearer fake_token');

      expect(response.statusCode).toBe(200);
      expect(response.body.code).toBe(AuthControllerCodes.GET_USER_SUCCESS.code);
      expect(response.body.payload).toHaveProperty('id');
      expect(response.body.payload).toHaveProperty('email');
      expect(response.body.payload).toHaveProperty('firstName');
      expect(response.body.payload).toHaveProperty('lastName');
      expect(response.body.payload).toHaveProperty('role');
    });
  });
});
