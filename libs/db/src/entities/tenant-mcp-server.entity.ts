import { Entity, PrimaryKey, Property, ManyToOne, Enum, Unique } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Tenant } from './tenant.entity';

export enum McpTransport {
  STDIO = 'stdio',
  SSE = 'sse',
  STREAMABLE_HTTP = 'streamable_http',
}

@Entity({ tableName: 'tenant_mcp_server' })
@Unique({ properties: ['tenant', 'name'] })
export class TenantMcpServer {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @Property()
  name!: string;

  @Enum(() => McpTransport)
  transport!: McpTransport;

  @Property({ nullable: true })
  url?: string;

  @Property({ nullable: true })
  command?: string;

  @Property({ type: 'jsonb', nullable: true })
  args?: string[];

  @Property({ type: 'jsonb', nullable: true })
  headersSecretRef?: Record<string, string>;

  @Property({ type: 'jsonb', nullable: true })
  envSecretRef?: Record<string, string>;

  @Property({ default: true })
  isEnabled: boolean = true;

  @Property()
  createdAt: Date = new Date();
}
