import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { ClientConfigDto } from '../dto/client-config.dto';

@Injectable()
export class ClientConfigService implements OnModuleInit {
  private clientConfig: ClientConfigDto;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const env = process.env.NODE_ENV || 'development';

    // Load config.json file
    const configPath = path.join(process.cwd(), 'config', 'config.json');
    const configFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const envConfig = configFile[env];

    if (!envConfig) {
      throw new Error(`Configuration for environment "${env}" not found in config.json`);
    }

    // Extract auth0Domain from auth0IssuerBaseUrl or use direct auth0Domain
    let auth0Domain = envConfig.auth0Domain;
    if (!auth0Domain && envConfig.auth0IssuerBaseUrl) {
      // Parse domain from issuer URL
      const url = new URL(envConfig.auth0IssuerBaseUrl);
      auth0Domain = url.host;
    }

    this.clientConfig = {
      auth0Domain,
      apiAudience: envConfig.apiAudience,
      auth0ClientId: envConfig.auth0ClientId,
      minIosVersion: envConfig.minIosVersion,
      minAndroidVersion: envConfig.minAndroidVersion,
      minWebVersion: envConfig.minWebVersion,
      shouldHealthCheckServer: true,
    };
  }

  public getClientConfig(): ClientConfigDto {
    return this.clientConfig;
  }
}
