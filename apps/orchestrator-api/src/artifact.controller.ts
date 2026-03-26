import { Controller, Post, Get, Param, UseGuards, Body, HttpCode, HttpStatus, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowArtifact, ArtifactKind, ArtifactStatus, WorkflowMirror, Tenant } from '@app/db';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@app/common';
import type { FastifyRequest } from 'fastify';

class UploadArtifactDto {
  @IsString()
  workflowId!: string;

  @IsString()
  tenantId!: string;

  @IsEnum(ArtifactKind)
  kind!: ArtifactKind;

  @IsString()
  title!: string;

  @IsString()
  filename!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

@ApiTags('artifacts')
@Controller('artifacts')
@ApiBearerAuth()
@UseGuards(AuthGuard, RbacGuard)
export class ArtifactController {
  private minioClient: Minio.Client;
  private readonly bucket: string;

  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT', { infer: true }) || 'localhost',
      port: parseInt(this.configService.get('MINIO_PORT', { infer: true }) || '9000', 10),
      useSSL: this.configService.get('MINIO_USE_SSL', { infer: true }) === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY', { infer: true }) || 'minioadmin',
      secretKey: this.configService.get('MINIO_SECRET_KEY', { infer: true }) || '',
    });
    this.bucket = this.configService.get('MINIO_BUCKET', { infer: true }) || 'artifacts';
  }

  @Post('presigned-upload')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Get presigned upload URL for artifact' })
  async getPresignedUpload(@Req() req: FastifyRequest, @Body() body: UploadArtifactDto): Promise<{ uploadUrl: string; artifactId: string }> {
    const userTenantId = (req as any).user?.tenantId;
    if (!userTenantId) throw new ForbiddenException('Tenant context required');
    if (body.tenantId !== userTenantId) throw new ForbiddenException('Cannot create artifacts for another tenant');
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: body.workflowId, tenant: userTenantId });
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
  async publishArtifact(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ status: string }> {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context required');
    const artifact = await this.em.findOneOrFail(WorkflowArtifact, { id, tenant: tenantId });
    artifact.status = ArtifactStatus.PUBLISHED;
    await this.em.flush();
    return { status: 'published' };
  }

  @Get(':id/download')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get presigned download URL for artifact' })
  async getDownloadUrl(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ downloadUrl: string }> {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context required');
    const artifact = await this.em.findOneOrFail(WorkflowArtifact, { id, tenant: tenantId });
    const objectKey = artifact.uri.replace(`s3://${this.bucket}/`, '');
    const presignedTtl = parseInt(this.configService.get('MINIO_PRESIGNED_TTL_SECONDS', { infer: true }) || '3600', 10);
    const downloadUrl = await this.minioClient.presignedGetObject(this.bucket, objectKey, presignedTtl);
    return { downloadUrl };
  }
}
