import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { WorkflowMirror } from './workflow-mirror.entity';
import { AgentSession } from './agent-session.entity';
import { Tenant } from './tenant.entity';

export enum ArtifactKind {
  MERGE_REQUEST = 'merge_request',
  DESIGN = 'design',
  DOCUMENT = 'document',
  REPORT = 'report',
  IMAGE = 'image',
  TEST_REPORT = 'test_report',
  BUILD_OUTPUT = 'build_output',
  OTHER = 'other',
}

export enum ArtifactStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity({ tableName: 'workflow_artifact' })
export class WorkflowArtifact {
  @PrimaryKey({ type: 'uuid' })
  id: string = v4();

  @ManyToOne(() => WorkflowMirror)
  @Index()
  workflow!: WorkflowMirror;

  @ManyToOne(() => AgentSession, { nullable: true })
  session?: AgentSession;

  @ManyToOne(() => Tenant)
  @Index()
  tenant!: Tenant;

  @Property({ nullable: true })
  stepId?: string;

  @Enum(() => ArtifactKind)
  kind!: ArtifactKind;

  @Property()
  title!: string;

  @Property()
  uri!: string;

  @Property({ nullable: true })
  mimeType?: string;

  @Property({ nullable: true })
  previewUrl?: string;

  @Property({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Property({ type: 'text', nullable: true })
  content?: string;

  @Enum(() => ArtifactStatus)
  status: ArtifactStatus = ArtifactStatus.DRAFT;

  @Property()
  createdAt: Date = new Date();
}
