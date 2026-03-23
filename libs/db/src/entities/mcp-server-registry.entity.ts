import { Entity, PrimaryKey, Property, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { McpTransport } from './tenant-mcp-server.entity';

export enum RegistryStatus {
  VERIFIED = 'verified',
  COMMUNITY = 'community',
  DEPRECATED = 'deprecated',
}

@Entity({ tableName: 'mcp_server_registry' })
export class McpServerRegistry {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @Property({ unique: true })
  slug!: string;

  @Property()
  name!: string;

  @Property({ nullable: true })
  description?: string;

  @Enum(() => McpTransport)
  transport!: McpTransport;

  @Property()
  endpoint!: string;

  @Enum(() => RegistryStatus)
  status: RegistryStatus = RegistryStatus.COMMUNITY;

  @Property({ type: 'jsonb', nullable: true })
  capabilities?: string[];

  @Property({ nullable: true })
  documentationUrl?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
