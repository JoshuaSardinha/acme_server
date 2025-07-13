import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { ClientConfigService } from './services/client-config.service';

@Module({
  controllers: [ConfigController],
  providers: [ClientConfigService],
  exports: [ClientConfigService],
})
export class ConfigsModule {}
