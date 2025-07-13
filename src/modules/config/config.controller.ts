import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { ClientConfigService } from './services/client-config.service';
import { ClientConfigDto } from './dto/client-config.dto';

@ApiTags('config')
@Controller('config')
export class ConfigController {
  constructor(private readonly clientConfigService: ClientConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get client configuration' })
  @ApiResponse({
    status: 200,
    description: 'Client configuration fetched successfully',
    type: ApiResponseDto,
  })
  @ResponseMessage('Client configuration fetched successfully', 'CONFIG_FETCH_SUCCESS')
  getConfig(): ClientConfigDto {
    return this.clientConfigService.getClientConfig();
  }
}
