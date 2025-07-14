import { Test, TestingModule } from '@nestjs/testing';
import { ConfigController } from './config.controller';
import { ClientConfigService } from './services/client-config.service';
import { ClientConfigDto } from './dto/client-config.dto';

describe('ConfigController', () => {
  let controller: ConfigController;
  let clientConfigService: ClientConfigService;

  const mockClientConfig: ClientConfigDto = {
    auth0Domain: 'dev-test.us.auth0.com',
    apiAudience: 'https://api.acme.com',
    auth0ClientId: 'test_client_id',
    minIosVersion: '1.0.0',
    minAndroidVersion: '1.0.0',
    minWebVersion: '1.0.0',
    shouldHealthCheckServer: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [
        {
          provide: ClientConfigService,
          useValue: {
            getClientConfig: jest.fn().mockReturnValue(mockClientConfig),
          },
        },
      ],
    }).compile();

    controller = module.get<ConfigController>(ConfigController);
    clientConfigService = module.get<ClientConfigService>(ClientConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getConfig', () => {
    it('should return client configuration successfully', () => {
      const result = controller.getConfig();

      expect(result).toEqual(mockClientConfig);
      expect(clientConfigService.getClientConfig).toHaveBeenCalled();
    });

    it('should call clientConfigService.getClientConfig once', () => {
      controller.getConfig();

      expect(clientConfigService.getClientConfig).toHaveBeenCalledTimes(1);
    });
  });
});
