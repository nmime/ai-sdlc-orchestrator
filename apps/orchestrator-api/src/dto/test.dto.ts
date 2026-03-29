import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TestMcpConnectivityDto {
  @ApiProperty({ description: 'Tenant ID', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  tenantId!: string;

  @ApiPropertyOptional({ description: 'Specific MCP server name to test', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serverName?: string;
}

export class TestSandboxDto {
  @ApiProperty({ description: 'Tenant ID', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  tenantId!: string;
}

export class TestAgentDryRunDto {
  @ApiProperty({ description: 'Tenant ID', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  tenantId!: string;

  @ApiPropertyOptional({ description: 'Repository ID to use for dry run', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  repoId?: string;
}
