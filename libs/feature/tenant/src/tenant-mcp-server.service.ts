import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Result } from 'neverthrow';
import { ResultUtils, PinoLoggerService } from '@ai-sdlc/common';
import type { AppError } from '@ai-sdlc/common';
import { TenantMcpServer, Tenant, McpTransport } from '@ai-sdlc/db';

export interface CreateMcpServerDto {
  name: string;
  transport: McpTransport;
  url?: string;
  command?: string;
  args?: string[];
  headersSecretRef?: Record<string, string>;
  envSecretRef?: Record<string, string>;
  isEnabled?: boolean;
}

export interface UpdateMcpServerDto {
  name?: string;
  transport?: McpTransport;
  url?: string;
  command?: string;
  args?: string[];
  headersSecretRef?: Record<string, string>;
  envSecretRef?: Record<string, string>;
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
    if (dto.headersSecretRef !== undefined) server.headersSecretRef = dto.headersSecretRef;
    if (dto.envSecretRef !== undefined) server.envSecretRef = dto.envSecretRef;
    if (dto.isEnabled !== undefined) server.isEnabled = dto.isEnabled;

    await this.em.persistAndFlush(server);
    this.logger.log(`MCP server created: ${server.name} for tenant ${tenantId}`);
    return ResultUtils.ok(server);
  }

  async list(tenantId: string): Promise<Result<TenantMcpServer[], AppError>> {
    const servers = await this.em.find(TenantMcpServer, { tenant: tenantId });
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
    if (dto.headersSecretRef !== undefined) server.headersSecretRef = dto.headersSecretRef;
    if (dto.envSecretRef !== undefined) server.envSecretRef = dto.envSecretRef;
    if (dto.isEnabled !== undefined) server.isEnabled = dto.isEnabled;

    await this.em.flush();
    return ResultUtils.ok(server);
  }

  async delete(tenantId: string, id: string): Promise<Result<void, AppError>> {
    const findResult = await this.findById(tenantId, id);
    if (findResult.isErr()) return findResult as unknown as Result<void, AppError>;
    await this.em.removeAndFlush(findResult.value);
    return ResultUtils.ok(undefined);
  }
}
