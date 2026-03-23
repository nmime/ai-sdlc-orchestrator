import { Entity, PrimaryKey, Property, ManyToOne, Enum } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { WorkflowMirror } from './workflow-mirror.entity';

export enum ArtifactType {
  MERGE_REQUEST = 'merge_request',
  DESIGN = 'design',
  DOCUMENT = 'document',
  REPORT = 'report',
  IMAGE = 'image',
  OTHER = 'other',
}

@Entity({ tableName: 'workflow_artifact' })
export class WorkflowArtifact {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => WorkflowMirror)
  workflow!: WorkflowMirror;

  @Enum(() => ArtifactType)
  type!: ArtifactType;

  @Property()
  name!: string;

  @Property({ nullable: true })
  description?: string;

  @Property({ nullable: true })
  storageUrl?: string;

  @Property({ nullable: true })
  externalUrl?: string;

  @Property({ type: 'int', nullable: true })
  sizeBytes?: number;

  @Property({ nullable: true })
  mimeType?: string;

  @Property({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Property()
  createdAt: Date = new Date();
}
