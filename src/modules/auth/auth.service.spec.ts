import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthService', () => {
  let service: AuthService;
  let userModel: any;
  let configService: ConfigService;

  const mockUser = {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    auth0_user_id: 'auth0|123456',
  };

  beforeEach(async () => {
    // Mock the User model
    userModel = {
      create: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User),
          useValue: userModel,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                AUTH0_ISSUER_BASE_URL: 'https://test.auth0.com',
                AUTH0_CLIENT_ID: 'test-client-id',
                AUTH0_CLIENT_SECRET: 'test-client-secret',
                AUTH0_MANAGEMENT_CLIENT_ID: 'test-mgmt-client-id',
                AUTH0_MANAGEMENT_CLIENT_SECRET: 'test-mgmt-secret',
                AUTH0_MANAGEMENT_AUDIENCE: 'https://test.auth0.com/api/v2/',
                API_AUDIENCE: 'https://api.test.com',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      userModel.create.mockResolvedValue(mockUser);

      const result = await service.createUser('John', 'Doe', 'john@example.com', 'auth0|123456');

      expect(userModel.create).toHaveBeenCalledWith({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        auth0_user_id: 'auth0|123456',
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error if creation fails', async () => {
      const error = new Error('Database error');
      userModel.create.mockRejectedValue(error);

      await expect(
        service.createUser('John', 'Doe', 'john@example.com', 'auth0|123456')
      ).rejects.toThrow(error);
    });
  });

  describe('findUserByEmail', () => {
    it('should find a user by email', async () => {
      userModel.findOne.mockResolvedValue(mockUser);

      const result = await service.findUserByEmail('john@example.com');

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when no user is found', async () => {
      userModel.findOne.mockResolvedValue(null);

      const result = await service.findUserByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findUserByAuth0Id', () => {
    it('should find a user by Auth0 ID', async () => {
      userModel.findOne.mockResolvedValue(mockUser);

      const result = await service.findUserByAuth0Id('auth0|123456');

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { auth0_user_id: 'auth0|123456' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('getManagementApiToken', () => {
    it('should get a new management API token', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-token',
          expires_in: 86400,
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.getManagementApiToken();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test.auth0.com/oauth/token',
        {
          grant_type: 'client_credentials',
          client_id: 'test-mgmt-client-id',
          client_secret: 'test-mgmt-secret',
          audience: 'https://test.auth0.com/api/v2/',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toBe('test-token');
    });

    it('should return cached token if still valid', async () => {
      // First call to get token
      const mockResponse = {
        data: {
          access_token: 'test-token',
          expires_in: 86400,
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      await service.getManagementApiToken();
      mockedAxios.post.mockClear();

      // Second call should use cached token
      const result = await service.getManagementApiToken();

      expect(mockedAxios.post).not.toHaveBeenCalled();
      expect(result).toBe('test-token');
    });
  });

  describe('signUpWithAuth0', () => {
    it('should sign up user successfully', async () => {
      // Mock management token
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'mgmt-token',
          expires_in: 86400,
        },
      });

      // Mock user creation
      const mockResponse = {
        data: {
          user_id: 'auth0|123456',
          email: 'john@example.com',
        },
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await service.signUpWithAuth0({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123!',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test.auth0.com/api/v2/users',
        {
          connection: 'Acme-DB',
          email: 'john@example.com',
          password: 'Password123!',
          user_metadata: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mgmt-token',
          },
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException for duplicate email', async () => {
      // Mock management token
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'mgmt-token',
          expires_in: 86400,
        },
      });

      // Mock duplicate email error
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 409,
          data: { error: 'user_exists' },
        },
      });

      await expect(
        service.signUpWithAuth0({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for weak password', async () => {
      // Mock management token
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'mgmt-token',
          expires_in: 86400,
        },
      });

      // Mock weak password error
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { message: 'PasswordStrengthError: Password is too weak' },
        },
      });

      await expect(
        service.signUpWithAuth0({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'weak',
        })
      ).rejects.toThrow('Password is too weak');
    });
  });
});
