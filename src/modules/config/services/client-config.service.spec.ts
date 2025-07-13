import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClientConfigService } from './client-config.service';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');

describe('ClientConfigService', () => {
  let service: ClientConfigService;
  let configService: ConfigService;

  const mockConfigJson = {
    development: {
      minIosVersion: '1.0.0',
      minAndroidVersion: '1.0.0',
      minWebVersion: '1.0.0',
      auth0Domain: 'dev-3jngnvbb08dw5nhq.us.auth0.com',
      auth0IssuerBaseUrl: 'https://dev-3jngnvbb08dw5nhq.us.auth0.com',
      apiAudience: 'https://api.nationalniner.com',
      auth0ClientId: 'vGxKHocnGDiFKqO4kbnltEO0ZP7fawWc',
    },
    test: {
      minIosVersion: '1.0.0',
      minAndroidVersion: '1.0.0',
      minWebVersion: '1.0.0',
      auth0Domain: 'test-auth0.us.auth0.com',
      apiAudience: 'https://api.test.nationalniner.com',
      auth0ClientId: 'test_client_id',
    },
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock path.join to return a consistent path
    (path.join as jest.Mock).mockReturnValue('/mock/config/config.json');

    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue('/mock');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ClientConfigService>(ClientConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('should load development configuration by default', () => {
      // Mock fs.readFileSync
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfigJson));

      // Mock NODE_ENV is not set
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      service.onModuleInit();

      expect(fs.readFileSync).toHaveBeenCalledWith('/mock/config/config.json', 'utf-8');

      const config = service.getClientConfig();
      expect(config).toEqual({
        auth0Domain: 'dev-3jngnvbb08dw5nhq.us.auth0.com',
        apiAudience: 'https://api.nationalniner.com',
        auth0ClientId: 'vGxKHocnGDiFKqO4kbnltEO0ZP7fawWc',
        minIosVersion: '1.0.0',
        minAndroidVersion: '1.0.0',
        minWebVersion: '1.0.0',
        shouldHealthCheckServer: true,
      });

      // Restore NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should load test configuration when NODE_ENV is test', () => {
      // Mock fs.readFileSync
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfigJson));

      // Set NODE_ENV to test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      service.onModuleInit();

      const config = service.getClientConfig();
      expect(config).toEqual({
        auth0Domain: 'test-auth0.us.auth0.com',
        apiAudience: 'https://api.test.nationalniner.com',
        auth0ClientId: 'test_client_id',
        minIosVersion: '1.0.0',
        minAndroidVersion: '1.0.0',
        minWebVersion: '1.0.0',
        shouldHealthCheckServer: true,
      });

      // Restore NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should extract auth0Domain from auth0IssuerBaseUrl if auth0Domain is not provided', () => {
      const configWithoutDomain = {
        development: {
          ...mockConfigJson.development,
          auth0Domain: undefined,
          auth0IssuerBaseUrl: 'https://extracted-domain.auth0.com',
        },
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configWithoutDomain));

      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      service.onModuleInit();

      const config = service.getClientConfig();
      expect(config.auth0Domain).toBe('extracted-domain.auth0.com');

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error if environment configuration is not found', () => {
      const incompleteConfig = {
        development: mockConfigJson.development,
        // test environment is missing
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(incompleteConfig));

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      expect(() => service.onModuleInit()).toThrow(
        'Configuration for environment "production" not found in config.json'
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error if config.json file cannot be read', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => service.onModuleInit()).toThrow('File not found');
    });
  });

  describe('getClientConfig', () => {
    it('should return the loaded configuration', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfigJson));

      // Since tests run with NODE_ENV=test, it will load test config
      service.onModuleInit();

      const config = service.getClientConfig();
      expect(config).toBeDefined();
      expect(config.auth0Domain).toBe('test-auth0.us.auth0.com');
      expect(config.apiAudience).toBe('https://api.test.nationalniner.com');
      expect(config.auth0ClientId).toBe('test_client_id');
      expect(config.shouldHealthCheckServer).toBe(true);
    });
  });
});
