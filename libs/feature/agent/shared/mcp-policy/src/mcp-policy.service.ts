import { Injectable } from '@nestjs/common';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { PinoLoggerService } from '@app/common';
import { TenantMcpServer, McpServerRegistry, McpServerPolicy } from '@app/db';
import type { McpServerConfig } from '@app/shared-type';

@Injectable()
export class McpPolicyService {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
  ) {
    this.logger.setContext('McpPolicyService');
  }

  async filterServers(
    tenantId: string,
    policy: McpServerPolicy,
  ): Promise<McpServerConfig[]> {
    const servers = await this.em.find(TenantMcpServer, {
      tenant: tenantId,
      isEnabled: true,
    }, { limit: 200 });

    if (policy === McpServerPolicy.OPEN) {
      return servers.map(s => this.toConfig(s));
    }

    const verifiedNames = await this.em.find(McpServerRegistry, { isVerified: true }, { limit: 200 });
    const verifiedSet = new Set(verifiedNames.map(r => r.name));

    const filtered: McpServerConfig[] = [];
    for (const server of servers) {
      if (verifiedSet.has(server.name)) {
        filtered.push(this.toConfig(server));
      } else {
        this.logger.warn(`MCP server '${server.name}' filtered out by curated policy for tenant ${tenantId}`);
      }
    }

    return filtered;
  }

  private toConfig(server: TenantMcpServer): McpServerConfig {
    return {
      name: server.name,
      transport: server.transport,
      url: server.url,
      command: server.command,
      args: server.args ?? undefined,
    };
  }
}
