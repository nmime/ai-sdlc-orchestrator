import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum McpTransport {
  STDIO = 'stdio',
  SSE = 'sse',
  STREAMABLE_HTTP = 'streamable_http',
}

@Entity({ tableName: 'tenant_mcp_server' })
export class TenantMcpServer {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Property()
  name!: string;

  @Enum(() => McpTransport)
  transport!: McpTransport;

  @Property()
  endpoint!: string;

  @Property({ type: 'jsonb', nullable: true })
  headers?: Record<string, string>;

  @Property({ type: 'jsonb', nullable: true })
  env?: Record<string, string>;

  @Property({ default: true })
  enabled: boolean = true;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
