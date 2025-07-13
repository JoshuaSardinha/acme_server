import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ClientVersionUpgradeRequiredException } from '../exceptions/client-version-upgrade-required.exception';
import { ConfigService } from '@nestjs/config';
import * as semver from 'semver';

@Injectable()
export class ClientVersionGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const request = context.switchToHttp().getRequest();
      const clientPlatform = request.headers['x-client-platform'] || 'unknown';
      const clientVersion = request.headers['x-client-version'] || '0.0.0';

      let requiredVersion: string;

      switch (clientPlatform.toLowerCase()) {
        case 'ios':
          requiredVersion = this.configService.get('MIN_IOS_VERSION', '0.0.0');
          break;
        case 'android':
          requiredVersion = this.configService.get('MIN_ANDROID_VERSION', '0.0.0');
          break;
        case 'web':
          requiredVersion = this.configService.get('MIN_WEB_VERSION', '0.0.0');
          break;
        default:
          requiredVersion = '0.0.0';
          break;
      }

      if (semver.lt(clientVersion, requiredVersion)) {
        // 426 is "Upgrade Required"
        throw new ClientVersionUpgradeRequiredException();
      }

      return true;
    } catch (error) {
      if (error instanceof ClientVersionUpgradeRequiredException) {
        throw error;
      }
      throw new BadRequestException('Error validating client version');
    }
  }
}
