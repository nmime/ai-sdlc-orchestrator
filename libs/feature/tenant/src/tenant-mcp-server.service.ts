import { Injectable } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/postgresql';
import { type Result, err } from 'neverthrow';
import { ResultUtils, type PinoLoggerService, sanitizeRecord, sanitizeLog } from '@app/common';
import type { AppError } from '@app/common';
import { TenantMcpServer, Tenant, McpTransport } from '@app/db';
import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsObject, MaxLength, ArrayMaxSize } from 'class-validator';

export class CreateMcpServerDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsEnum(McpTransport)
  transport!: McpTransport;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  command?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  args?: string[];

  @IsOptional()
  @IsObject()
  headersSecretRef?: Record<string, string>;

  @IsOptional()
  @IsObject()
  envSecretRef?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateMcpServerDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEnum(McpTransport)
  transport?: McpTransport;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  command?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  args?: string[];

  @IsOptional()
  @IsObject()
  headersSecretRef?: Record<string, string>;

  @IsOptional()
  @IsObject()
  envSecretRef?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

@Injectable()
export class TenantMcpServerService {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('TenantMcpServerService');
  }

  async create(tenantId: string, dto: CreateMcpServerDto): Promise<Result<TenantMcpServer, AppError>> {
    const existing = await this.em.findOne(TenantMcpServer, { tenant: tenantId, name: dto.name });
    if (existing) return ResultUtils.err('CONFLICT', `MCP server '${dto.name}' already exists for this tenant`);

    const server = new TenantMcpServer();
    server.tenant = this.em.getReference(Tenant, tenantId);
    server.name = dto.name;
    server.transport = dto.transport;
    if (dto.url !== undefined) server.url = dto.url;
    if (dto.command !== undefined) server.command = dto.command;
    if (dto.args !== undefined) server.args = dto.args;
    if (dto.headersSecretRef !== undefined) server.headersSecretRef = sanitizeRecord(dto.headersSecretRef) as Record<string, string>;
    if (dto.envSecretRef !== undefined) server.envSecretRef = sanitizeRecord(dto.envSecretRef) as Record<string, string>;
    if (dto.isEnabled !== undefined) server.isEnabled = dto.isEnabled;

    await this.em.persistAndFlush(server);
    this.logger.log(`MCP server created: ${sanitizeLog(server.name)} for tenant ${sanitizeLog(tenantId)}`);
    return ResultUtils.ok(server);
  }

  async list(tenantId: string): Promise<Result<TenantMcpServer[], AppError>> {
    const servers = await this.em.find(TenantMcpServer, { tenant: tenantId }, { limit: 200 });
    return ResultUtils.ok(servers);
  }

  async findById(tenantId: string, id: string): Promise<Result<TenantMcpServer, AppError>> {
    const server = await this.em.findOne(TenantMcpServer, { id, tenant: tenantId });
    if (!server) return ResultUtils.err('NOT_FOUND', `MCP server ${id} not found`);
    return ResultUtils.ok(server);
  }

  async update(tenantId: string, id: string, dto: UpdateMcpServerDto): Promise<Result<TenantMcpServer, AppError>> {
    const findResult = await this.findById(tenantId, id);
    if (findResult.isErr()) return findResult;

    const server = findResult.value;
    if (dto.name !== undefined) server.name = dto.name;
    if (dto.transport !== undefined) server.transport = dto.transport;
    if (dto.url !== undefined) server.url = dto.url;
    if (dto.command !== undefined) server.command = dto.command;
    if (dto.args !== undefined) server.args = dto.args;
    if (dto.headersSecretRef !== undefined) server.headersSecretRef = sanitizeRecord(dto.headersSecretRef) as Record<string, string>;
    if (dto.envSecretRef !== undefined) server.envSecretRef = sanitizeRecord(dto.envSecretRef) as Record<string, string>;
    if (dto.isEnabled !== undefined) server.isEnabled = dto.isEnabled;

    await this.em.flush();
    return ResultUtils.ok(server);
  }

  async delete(tenantId: string, id: string): Promise<Result<void, AppError>> {
    const findResult = await this.findById(tenantId, id);
    if (findResult.isErr()) return err(findResult.error);
    await this.em.removeAndFlush(findResult.value);
    return ResultUtils.ok(undefined);
  }
}
