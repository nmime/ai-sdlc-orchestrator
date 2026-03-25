import { Controller, Post, Get, Param, UseGuards, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, RbacGuard, Roles } from '@app/feature-tenant';
import { EntityManager } from '@mikro-orm/postgresql';
import { WorkflowArtifact, ArtifactKind, ArtifactStatus, WorkflowMirror, Tenant } from '@app/db';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import * as Minio from 'minio';

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

  constructor(private readonly em: EntityManager) {
    this.minioClient = new Minio.Client({
      endPoint: process.env['MINIO_ENDPOINT'] || 'localhost',
      port: parseInt(process.env['MINIO_PORT'] || '9000', 10),
      useSSL: false,
      accessKey: process.env['MINIO_ACCESS_KEY'] || 'minioadmin',
      secretKey: process.env['MINIO_SECRET_KEY'] || '',
    });
    this.bucket = process.env['MINIO_BUCKET'] || 'artifacts';
  }

  @Post('presigned-upload')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Get presigned upload URL for artifact' })
  async getPresignedUpload(@Body() body: UploadArtifactDto): Promise<{ uploadUrl: string; artifactId: string }> {
    const mirror = await this.em.findOneOrFail(WorkflowMirror, { temporalWorkflowId: body.workflowId });
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
    const uploadUrl = await this.minioClient.presignedPutObject(this.bucket, objectKey, 3600);
    return { uploadUrl, artifactId: artifact.id };
  }

  @Post(':id/publish')
  @Roles('admin', 'operator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish artifact after upload' })
  async publishArtifact(@Param('id') id: string): Promise<{ status: string }> {
    const artifact = await this.em.findOneOrFail(WorkflowArtifact, { id });
    artifact.status = ArtifactStatus.PUBLISHED;
    await this.em.flush();
    return { status: 'published' };
  }

  @Get(':id/download')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'Get presigned download URL for artifact' })
  async getDownloadUrl(@Param('id') id: string): Promise<{ downloadUrl: string }> {
    const artifact = await this.em.findOneOrFail(WorkflowArtifact, { id });
    const objectKey = artifact.uri.replace(`s3://${this.bucket}/`, '');
    const downloadUrl = await this.minioClient.presignedGetObject(this.bucket, objectKey, 3600);
    return { downloadUrl };
  }
}
