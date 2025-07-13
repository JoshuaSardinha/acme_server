import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsDate,
  IsNumber,
  IsObject,
} from 'class-validator';

// Cache Entry Metadata DTO
export class CacheMetadataDto {
  @ApiProperty({ description: 'Cache key' })
  @Expose()
  @IsString()
  key: string;

  @ApiProperty({ description: 'When the cache entry was created' })
  @Expose()
  @IsDate()
  created_at: Date;

  @ApiProperty({ description: 'When the cache entry expires' })
  @Expose()
  @IsDate()
  expires_at: Date;

  @ApiProperty({ description: 'Cache hit count' })
  @Expose()
  @IsNumber()
  hit_count: number;

  @ApiProperty({ description: 'Last access timestamp' })
  @Expose()
  @IsDate()
  last_accessed: Date;

  @ApiProperty({ description: 'Size of cached data in bytes' })
  @Expose()
  @IsNumber()
  size_bytes: number;
}

// Permission Cache Entry DTO
export class PermissionCacheEntryDto {
  @ApiProperty({ description: 'User ID' })
  @Expose()
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'Cached permission data' })
  @Expose()
  @IsObject()
  permissions: any;

  @ApiProperty({ description: 'Cache metadata' })
  @Expose()
  @Type(() => CacheMetadataDto)
  metadata: CacheMetadataDto;

  @ApiProperty({ description: 'Whether the cache entry is valid' })
  @Expose()
  @IsBoolean()
  is_valid: boolean;
}

// Cache Invalidation Request DTO
export class InvalidateCacheDto {
  @ApiPropertyOptional({ description: 'User ID to invalidate cache for' })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({ description: 'Company ID to invalidate cache for all users' })
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @ApiPropertyOptional({ description: 'Role ID to invalidate cache for users with this role' })
  @IsOptional()
  @IsUUID()
  role_id?: string;

  @ApiPropertyOptional({ description: 'Permission name to invalidate cache for users who have it' })
  @IsOptional()
  @IsString()
  permission_name?: string;

  @ApiPropertyOptional({ description: 'Invalidate all permission caches' })
  @IsOptional()
  @IsBoolean()
  invalidate_all?: boolean = false;

  @ApiPropertyOptional({ description: 'Reason for cache invalidation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// Cache Invalidation Response DTO
export class CacheInvalidationResponseDto {
  @ApiProperty({ description: 'Number of cache entries invalidated' })
  @Expose()
  @IsNumber()
  invalidated_count: number;

  @ApiProperty({ description: 'Cache keys that were invalidated', type: [String] })
  @Expose()
  invalidated_keys: string[];

  @ApiProperty({ description: 'Invalidation timestamp' })
  @Expose()
  @IsDate()
  invalidated_at: Date;

  @ApiPropertyOptional({ description: 'Reason for invalidation' })
  @Expose()
  @IsOptional()
  @IsString()
  reason?: string;
}

// Cache Statistics DTO
export class CacheStatisticsDto {
  @ApiProperty({ description: 'Total number of cache entries' })
  @Expose()
  @IsNumber()
  total_entries: number;

  @ApiProperty({ description: 'Number of active (non-expired) entries' })
  @Expose()
  @IsNumber()
  active_entries: number;

  @ApiProperty({ description: 'Number of expired entries' })
  @Expose()
  @IsNumber()
  expired_entries: number;

  @ApiProperty({ description: 'Total cache hits' })
  @Expose()
  @IsNumber()
  total_hits: number;

  @ApiProperty({ description: 'Total cache misses' })
  @Expose()
  @IsNumber()
  total_misses: number;

  @ApiProperty({ description: 'Cache hit ratio (0-1)' })
  @Expose()
  @IsNumber()
  hit_ratio: number;

  @ApiProperty({ description: 'Total memory usage in bytes' })
  @Expose()
  @IsNumber()
  memory_usage_bytes: number;

  @ApiProperty({ description: 'Average cache entry size in bytes' })
  @Expose()
  @IsNumber()
  average_entry_size: number;

  @ApiProperty({ description: 'When statistics were calculated' })
  @Expose()
  @IsDate()
  calculated_at: Date;
}

// Cache Configuration DTO
export class CacheConfigDto {
  @ApiProperty({ description: 'Default TTL in seconds' })
  @Expose()
  @IsNumber()
  default_ttl_seconds: number;

  @ApiProperty({ description: 'Maximum number of entries' })
  @Expose()
  @IsNumber()
  max_entries: number;

  @ApiProperty({ description: 'Maximum memory usage in bytes' })
  @Expose()
  @IsNumber()
  max_memory_bytes: number;

  @ApiProperty({ description: 'Whether cache is enabled' })
  @Expose()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Cache cleanup interval in seconds' })
  @Expose()
  @IsNumber()
  cleanup_interval_seconds: number;
}

// Cache Warmup Request DTO
export class CacheWarmupDto {
  @ApiPropertyOptional({ description: 'User IDs to warm up cache for', type: [String] })
  @IsOptional()
  @IsUUID(4, { each: true })
  user_ids?: string[];

  @ApiPropertyOptional({ description: 'Company ID to warm up cache for all users' })
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @ApiPropertyOptional({ description: 'Role ID to warm up cache for users with this role' })
  @IsOptional()
  @IsUUID()
  role_id?: string;

  @ApiPropertyOptional({ description: 'Warm up cache for all users' })
  @IsOptional()
  @IsBoolean()
  warmup_all?: boolean = false;
}

// Cache Warmup Response DTO
export class CacheWarmupResponseDto {
  @ApiProperty({ description: 'Number of cache entries created' })
  @Expose()
  @IsNumber()
  warmed_count: number;

  @ApiProperty({ description: 'Number of users processed' })
  @Expose()
  @IsNumber()
  users_processed: number;

  @ApiProperty({ description: 'Time taken for warmup in milliseconds' })
  @Expose()
  @IsNumber()
  duration_ms: number;

  @ApiProperty({ description: 'Warmup completion timestamp' })
  @Expose()
  @IsDate()
  completed_at: Date;

  @ApiProperty({ description: 'Any errors encountered during warmup', type: [String] })
  @Expose()
  errors: string[];
}
