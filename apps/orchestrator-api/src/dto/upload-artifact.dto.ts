import { IsString, IsOptional, IsEnum, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArtifactKind } from '@app/db';

export class UploadArtifactDto {
  @ApiProperty({ description: 'Workflow ID', maxLength: 255, pattern: '^[a-zA-Z0-9_-]+$' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'workflowId must be alphanumeric with hyphens/underscores' })
  @MaxLength(255)
  workflowId!: string;

  @ApiProperty({ description: 'Tenant ID', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  tenantId!: string;

  @ApiProperty({ enum: ArtifactKind, description: 'Artifact kind' })
  @IsEnum(ArtifactKind)
  kind!: ArtifactKind;

  @ApiProperty({ description: 'Artifact title', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Filename (alphanumeric, dots, hyphens, underscores)', maxLength: 255, pattern: '^[a-zA-Z0-9._-]+$' })
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'filename must not contain path separators or special characters' })
  @MaxLength(255)
  filename!: string;

  @ApiPropertyOptional({ description: 'MIME type', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimeType?: string;
}
