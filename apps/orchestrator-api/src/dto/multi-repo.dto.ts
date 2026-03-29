import { IsString, IsArray, ValidateNested, IsOptional, IsIn, ArrayMaxSize, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RepoInput {
  @ApiProperty({ description: 'Repository ID', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  repoId!: string;

  @ApiProperty({ description: 'Repository URL', maxLength: 2048 })
  @IsString()
  @MaxLength(2048)
  repoUrl!: string;

  @ApiProperty({ description: 'Task ID', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  taskId!: string;

  @ApiPropertyOptional({ description: 'Labels', type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  labels?: string[];
}

export class StartMultiRepoDto {
  @ApiProperty({ description: 'Tenant ID', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  tenantId!: string;

  @ApiProperty({ description: 'Parent task ID', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  parentTaskId!: string;

  @ApiProperty({ description: 'Task provider', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  taskProvider!: string;

  @ApiProperty({ description: 'Repository inputs', type: [RepoInput], maxItems: 50 })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepoInput)
  @ArrayMaxSize(50)
  repos!: RepoInput[];

  @ApiPropertyOptional({ description: 'Failure strategy', enum: ['wait_all', 'fail_fast'] })
  @IsOptional()
  @IsIn(['wait_all', 'fail_fast'])
  failureStrategy?: 'wait_all' | 'fail_fast';
}
