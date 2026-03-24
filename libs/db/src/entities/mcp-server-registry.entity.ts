import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { v4 } from 'uuid';

@Entity({ tableName: 'mcp_server_registry' })
export class McpServerRegistry {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @Property({ unique: true })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ nullable: true })
  protocolVersion?: string;

  @Property({ nullable: true })
  scopingCapability?: string;

  @Property({ default: false })
  isVerified: boolean = false;

  @Property({ type: 'jsonb', nullable: true })
  defaultConfig?: Record<string, unknown>;

  @Property()
  createdAt: Date = new Date();
}
