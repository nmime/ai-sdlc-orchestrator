import { Controller, Post, Get, Param, UseGuards, Body, HttpCode, HttpStatus, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { AuthGuard, RbacGuard, Roles, TenantId } from '@app/feature-tenant';
import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowArtifact, ArtifactKind, ArtifactStatus, WorkflowMirror, Tenant } from '@app/db';
import { UploadArtifactDto } from './dto';
import type { Client as MinioClient } from 'minio';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@app/common';
import { MINIO_CLIENT } from '@app/common';

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
  @ApiBody({ type: UploadArtifactDto })
  @ApiResponse({ status: 201, description: 'Presigned upload URL generated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Cannot create artifacts for another tenant' })
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
  @ApiParam({ name: 'id', description: 'Artifact ID' })
  @ApiResponse({ status: 200, description: 'Artifact published' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Artifact not found' })
  async publishArtifact(@TenantId() tenantId: string, @Param('id') id: string): Promise<{ status: string }> {
    const artifact = await this.em.findOneOrFail(WorkflowArtifact, { id, tenant: tenantId });
    artifact.status = ArtifactStatus.PUBLISHED;
    await this.em.flush();
    return { status: 'published' };
  }

  @Get(':id/download')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get presigned download URL for artifact' })
  @ApiParam({ name: 'id', description: 'Artifact ID' })
  @ApiResponse({ status: 200, description: 'Presigned download URL returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Artifact not found' })
  async getDownloadUrl(@TenantId() tenantId: string, @Param('id') id: string): Promise<{ downloadUrl: string }> {
    const artifact = await this.em.findOneOrFail(WorkflowArtifact, { id, tenant: tenantId });
    const objectKey = artifact.uri.replace(`s3://${this.bucket}/`, '');
    const presignedTtl = parseInt(this.configService.get('MINIO_PRESIGNED_TTL_SECONDS', { infer: true }) || '3600', 10);
    const downloadUrl = await this.minioClient.presignedGetObject(this.bucket, objectKey, presignedTtl);
    return { downloadUrl };
  }
}
