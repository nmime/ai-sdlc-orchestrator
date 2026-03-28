import { Controller, Post, Get, Param, UseGuards, Body, HttpCode, HttpStatus, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, RbacGuard, Roles, TenantId } from '@app/feature-tenant';
import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowArtifact, ArtifactKind, ArtifactStatus, WorkflowMirror, Tenant } from '@app/db';
import { IsString, IsOptional, IsEnum, MaxLength, Matches } from 'class-validator';
import type { Client as MinioClient } from 'minio';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@app/common';
import { MINIO_CLIENT } from '@app/common';

class UploadArtifactDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'workflowId must be alphanumeric with hyphens/underscores' })
  @MaxLength(255)
  workflowId!: string;

  @IsString()
  @MaxLength(255)
  tenantId!: string;

  @IsEnum(ArtifactKind)
  kind!: ArtifactKind;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'filename must not contain path separators or special characters' })
  @MaxLength(255)
  filename!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimeType?: string;
}

@ApiTags('artifacts')
@Controller('artifacts')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class ArtifactController {
  private readonly bucket: string;

  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(MINIO_CLIENT) private readonly minioClient: MinioClient,
  ) {
    this.bucket = this.configService.get('MINIO_BUCKET', { infer: true }) || 'artifacts';
  }

  @Post('presigned-upload')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Get presigned upload URL for artifact' })
  async getPresignedUpload(@TenantId() authTenantId: string, @Body() body: UploadArtifactDto): Promise<{ uploadUrl: string; artifactId: string }> {
    if (body.tenantId !== authTenantId) throw new ForbiddenException('Cannot create artifacts for another tenant');
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: body.workflowId, tenant: authTenantId });
    const artifact = new WorkflowArtifact();
    artifact.workflow = this.em.getReference(WorkflowMirror, mirror.id);
    artifact.tenant = this.em.getReference(Tenant, body.tenantId);
    artifact.kind = body.kind;
    artifact.title = body.title;
    artifact.uri = `s3://${this.bucket}/${body.workflowId}/${artifact.id}/${body.filename}`;
    if (body.mimeType) artifact.mimeType = body.mimeType;
    artifact.status = ArtifactStatus.DRAFT;
    await this.em.persistAndFlush(artifact);

    const objectKey = `${body.workflowId}/${artifact.id}/${body.filename}`;
    const presignedTtl = parseInt(this.configService.get('MINIO_PRESIGNED_TTL_SECONDS', { infer: true }) || '3600', 10);
    const uploadUrl = await this.minioClient.presignedPutObject(this.bucket, objectKey, presignedTtl);
    return { uploadUrl, artifactId: artifact.id };
  }

  @Post(':id/publish')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish artifact after upload' })
  async publishArtifact(@TenantId() tenantId: string, @Param('id') id: string): Promise<{ status: string }> {
    const artifact = await this.em.findOneOrFail(WorkflowArtifact, { id, tenant: tenantId });
    artifact.status = ArtifactStatus.PUBLISHED;
    await this.em.flush();
    return { status: 'published' };
  }

  @Get(':id/download')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get presigned download URL for artifact' })
  async getDownloadUrl(@TenantId() tenantId: string, @Param('id') id: string): Promise<{ downloadUrl: string }> {
    const artifact = await this.em.findOneOrFail(WorkflowArtifact, { id, tenant: tenantId });
    const objectKey = artifact.uri.replace(`s3://${this.bucket}/`, '');
    const presignedTtl = parseInt(this.configService.get('MINIO_PRESIGNED_TTL_SECONDS', { infer: true }) || '3600', 10);
    const downloadUrl = await this.minioClient.presignedGetObject(this.bucket, objectKey, presignedTtl);
    return { downloadUrl };
  }
}
