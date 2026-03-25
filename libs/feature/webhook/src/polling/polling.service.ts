import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { PinoLoggerService, TemporalClientService } from '@app/common';
import { PollingSchedule, WorkflowMirror } from '@app/db';

export interface PollResult {
  taskId: string;
  taskProvider: string;
  repoId: string;
  repoUrl: string;
}

@Injectable()
export class PollingService implements OnModuleInit, OnModuleDestroy {
  private interval?: ReturnType<typeof setInterval>;

  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLoggerService,
    private readonly temporalClient: TemporalClientService,
  ) {
    this.logger.setContext('PollingService');
  }

  onModuleInit() {
    this.interval = setInterval(() => this.pollAll(), 60_000);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  async pollAll(): Promise<void> {
    const fork = this.em.fork();
    const schedules = await fork.find(PollingSchedule, {
      enabled: true,
    }, { populate: ['tenant', 'repoConfig'] });

    const now = new Date();
    for (const schedule of schedules) {
      const lastPoll = schedule.lastPollAt?.getTime() ?? 0;
      if (now.getTime() - lastPoll < schedule.pollIntervalSeconds * 1000) continue;

      try {
        const tasks = await this.fetchTasks(schedule);
        for (const task of tasks) {
          const existing = await fork.findOne(WorkflowMirror, {
            tenant: schedule.tenant.id,
            taskId: task.taskId,
            taskProvider: task.taskProvider,
          });
          if (existing) continue;

          const client = await this.temporalClient.getClient();
          await client.workflow.start('orchestrateTaskWorkflow', {
            taskQueue: 'orchestrator-queue',
            workflowId: `poll-${schedule.tenant.id}-${task.taskId}`,
            args: [{
              tenantId: schedule.tenant.id,
              taskId: task.taskId,
              taskProvider: task.taskProvider,
              repoId: task.repoId,
              repoUrl: task.repoUrl,
              webhookDeliveryId: `poll-${Date.now()}`,
            }],
          });
          this.logger.log(`Started workflow for polled task ${task.taskId}`);
        }

        schedule.lastPollAt = now;
      } catch (error) {
        this.logger.error(`Polling failed for schedule ${schedule.id}: ${(error as Error).message}`);
      }
    }
    await fork.flush();
  }

  private async fetchTasks(schedule: PollingSchedule): Promise<PollResult[]> {
    const platform = schedule.platform;
    const filter = schedule.queryFilter ?? {};

    switch (platform) {
      case 'jira':
        return this.fetchJiraTasks(filter);
      case 'github':
        return this.fetchGithubTasks(filter);
      case 'gitlab':
        return this.fetchGitlabTasks(filter);
      case 'linear':
        return this.fetchLinearTasks(filter);
      default:
        return [];
    }
  }

  private async fetchJiraTasks(filter: Record<string, unknown>): Promise<PollResult[]> {
    const baseUrl = filter['baseUrl'] as string;
    const jql = filter['jql'] as string;
    const token = filter['token'] as string;
    if (!baseUrl || !jql) return [];

    try {
      const response = await fetch(`${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=10`, {
        headers: {
          'Authorization': `Basic ${token}`,
          'Accept': 'application/json',
        },
      });
      if (!response.ok) return [];
      const data = await response.json() as { issues: Array<{ key: string; fields: { summary: string } }> };
      return data.issues.map(issue => ({
        taskId: issue.key,
        taskProvider: 'jira',
        repoId: filter['repoId'] as string || '',
        repoUrl: filter['repoUrl'] as string || '',
      }));
    } catch {
      return [];
    }
  }

  private async fetchGithubTasks(filter: Record<string, unknown>): Promise<PollResult[]> {
    const repo = filter['repo'] as string;
    const labels = filter['labels'] as string;
    const token = filter['token'] as string;
    if (!repo) return [];

    try {
      const url = `https://api.github.com/repos/${repo}/issues?state=open&labels=${labels || 'ai-sdlc'}&per_page=10`;
      const response = await fetch(url, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
      });
      if (!response.ok) return [];
      const issues = await response.json() as Array<{ number: number; title: string }>;
      return issues.map(issue => ({
        taskId: `${issue.number}`,
        taskProvider: 'github',
        repoId: repo,
        repoUrl: `https://github.com/${repo}.git`,
      }));
    } catch {
      return [];
    }
  }

  private async fetchGitlabTasks(filter: Record<string, unknown>): Promise<PollResult[]> {
    const projectId = filter['projectId'] as string;
    const baseUrl = (filter['baseUrl'] as string) || 'https://gitlab.com';
    const token = filter['token'] as string;
    if (!projectId) return [];

    try {
      const url = `${baseUrl}/api/v4/projects/${projectId}/issues?state=opened&labels=${filter['labels'] || 'ai-sdlc'}&per_page=10`;
      const response = await fetch(url, {
        headers: { 'PRIVATE-TOKEN': token },
      });
      if (!response.ok) return [];
      const issues = await response.json() as Array<{ iid: number; title: string; web_url: string }>;
      return issues.map(issue => ({
        taskId: `${issue.iid}`,
        taskProvider: 'gitlab',
        repoId: projectId,
        repoUrl: filter['repoUrl'] as string || '',
      }));
    } catch {
      return [];
    }
  }

  private async fetchLinearTasks(filter: Record<string, unknown>): Promise<PollResult[]> {
    const token = filter['token'] as string;
    const teamId = filter['teamId'] as string;
    if (!token || !teamId) return [];

    try {
      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{ team(id: "${teamId}") { issues(filter: { state: { name: { in: ["Todo", "In Progress"] } }, labels: { name: { in: ["ai-sdlc"] } } }, first: 10) { nodes { id identifier title } } } }`,
        }),
      });
      if (!response.ok) return [];
      const data = await response.json() as { data: { team: { issues: { nodes: Array<{ id: string; identifier: string }> } } } };
      return data.data.team.issues.nodes.map(issue => ({
        taskId: issue.identifier,
        taskProvider: 'linear',
        repoId: filter['repoId'] as string || '',
        repoUrl: filter['repoUrl'] as string || '',
      }));
    } catch {
      return [];
    }
  }
}
