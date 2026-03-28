import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { v4 } from 'uuid';

@Entity({ tableName: 'system_settings' })
export class SystemSettings {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @Property({ unique: true })
  key!: string;

  @Property({ type: 'text' })
  value!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'text', default: 'string' })
  valueType: string = 'string';

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
