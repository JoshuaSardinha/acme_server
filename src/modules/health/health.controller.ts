import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy', type: ApiResponseDto })
  @ResponseMessage('Server is healthy!', 'HEALTH_CHECK_SUCCESS')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('up')
  @ApiOperation({ summary: 'Uptime check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is up', type: ApiResponseDto })
  @ResponseMessage('Server is up!', 'HEALTH_CHECK_SUCCESS')
  getUp() {
    return { status: 'up', timestamp: new Date().toISOString() };
  }
}
