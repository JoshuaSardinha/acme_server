import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsString, IsBoolean, IsDate, IsNumber, IsOptional } from 'class-validator';

// Standard API Response wrapper for permission operations
export class PermissionResponseDto<T = any> {
  @ApiProperty({ description: 'Operation success status' })
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty({ description: 'Response code' })
  @Expose()
  @IsString()
  code: string;

  @ApiProperty({ description: 'Response message' })
  @Expose()
  @IsString()
  message: string;

  @ApiProperty({ description: 'Response payload' })
  @Expose()
  payload: T;

  @ApiPropertyOptional({ description: 'Response timestamp' })
  @Expose()
  @IsOptional()
  @IsDate()
  timestamp?: Date;

  @ApiPropertyOptional({ description: 'Request ID for tracing' })
  @Expose()
  @IsOptional()
  @IsString()
  request_id?: string;
}

// Pagination Metadata DTO
export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number' })
  @Expose()
  @IsNumber()
  page: number;

  @ApiProperty({ description: 'Items per page' })
  @Expose()
  @IsNumber()
  limit: number;

  @ApiProperty({ description: 'Total number of items' })
  @Expose()
  @IsNumber()
  total: number;

  @ApiProperty({ description: 'Total number of pages' })
  @Expose()
  @IsNumber()
  total_pages: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  @Expose()
  @IsBoolean()
  has_next: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  @Expose()
  @IsBoolean()
  has_prev: boolean;

  @ApiPropertyOptional({ description: 'Next page number' })
  @Expose()
  @IsOptional()
  @IsNumber()
  next_page?: number;

  @ApiPropertyOptional({ description: 'Previous page number' })
  @Expose()
  @IsOptional()
  @IsNumber()
  prev_page?: number;
}

// Paginated Response DTO
export class PaginatedResponseDto<T = any> {
  @ApiProperty({ description: 'Array of items' })
  @Expose()
  data: T[];

  @ApiProperty({ description: 'Pagination metadata' })
  @Expose()
  @Type(() => PaginationMetaDto)
  meta: PaginationMetaDto;
}

// Operation Status Response DTO
export class OperationStatusDto {
  @ApiProperty({ description: 'Operation ID' })
  @Expose()
  @IsString()
  operation_id: string;

  @ApiProperty({ description: 'Operation status' })
  @Expose()
  @IsString()
  status: 'pending' | 'in_progress' | 'completed' | 'failed';

  @ApiProperty({ description: 'Operation progress (0-100)' })
  @Expose()
  @IsNumber()
  progress: number;

  @ApiProperty({ description: 'Operation start time' })
  @Expose()
  @IsDate()
  started_at: Date;

  @ApiPropertyOptional({ description: 'Operation completion time' })
  @Expose()
  @IsOptional()
  @IsDate()
  completed_at?: Date;

  @ApiPropertyOptional({ description: 'Operation result' })
  @Expose()
  @IsOptional()
  result?: any;

  @ApiPropertyOptional({ description: 'Error message if operation failed' })
  @Expose()
  @IsOptional()
  @IsString()
  error?: string;
}

// Bulk Operation Result DTO
export class BulkOperationResultDto {
  @ApiProperty({ description: 'Total number of items processed' })
  @Expose()
  @IsNumber()
  total: number;

  @ApiProperty({ description: 'Number of successful operations' })
  @Expose()
  @IsNumber()
  successful: number;

  @ApiProperty({ description: 'Number of failed operations' })
  @Expose()
  @IsNumber()
  failed: number;

  @ApiProperty({ description: 'Details of failed operations', type: [String] })
  @Expose()
  errors: string[];

  @ApiProperty({ description: 'Operation duration in milliseconds' })
  @Expose()
  @IsNumber()
  duration_ms: number;

  @ApiProperty({ description: 'Operation completion timestamp' })
  @Expose()
  @IsDate()
  completed_at: Date;
}

// Permission Audit Response DTO
export class PermissionAuditDto {
  @ApiProperty({ description: 'Audit entry ID' })
  @Expose()
  @IsString()
  id: string;

  @ApiProperty({ description: 'User who performed the action' })
  @Expose()
  @IsString()
  actor_id: string;

  @ApiProperty({ description: 'User affected by the action' })
  @Expose()
  @IsString()
  target_user_id: string;

  @ApiProperty({ description: 'Action performed' })
  @Expose()
  @IsString()
  action: string;

  @ApiProperty({ description: 'Resource affected' })
  @Expose()
  @IsString()
  resource: string;

  @ApiProperty({ description: 'Resource ID' })
  @Expose()
  @IsString()
  resource_id: string;

  @ApiPropertyOptional({ description: 'Additional details' })
  @Expose()
  @IsOptional()
  details?: any;

  @ApiProperty({ description: 'Action timestamp' })
  @Expose()
  @IsDate()
  timestamp: Date;

  @ApiPropertyOptional({ description: 'Client IP address' })
  @Expose()
  @IsOptional()
  @IsString()
  ip_address?: string;

  @ApiPropertyOptional({ description: 'User agent' })
  @Expose()
  @IsOptional()
  @IsString()
  user_agent?: string;
}

// Health Check Response DTO
export class PermissionSystemHealthDto {
  @ApiProperty({ description: 'Overall system health status' })
  @Expose()
  @IsString()
  status: 'healthy' | 'degraded' | 'unhealthy';

  @ApiProperty({ description: 'Database connection status' })
  @Expose()
  @IsString()
  database: 'connected' | 'disconnected' | 'error';

  @ApiProperty({ description: 'Cache system status' })
  @Expose()
  @IsString()
  cache: 'active' | 'inactive' | 'error';

  @ApiProperty({ description: 'Permission service status' })
  @Expose()
  @IsString()
  permissions_service: 'active' | 'inactive' | 'error';

  @ApiProperty({ description: 'Health check timestamp' })
  @Expose()
  @IsDate()
  checked_at: Date;

  @ApiProperty({ description: 'Response time in milliseconds' })
  @Expose()
  @IsNumber()
  response_time_ms: number;

  @ApiPropertyOptional({ description: 'Additional health details' })
  @Expose()
  @IsOptional()
  details?: any;
}
