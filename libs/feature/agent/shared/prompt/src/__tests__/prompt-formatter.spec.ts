import { PromptFormatter } from '../prompt-formatter';
import type { AgentPromptData } from '@app/shared-type';

describe('PromptFormatter', () => {
  const formatter = new PromptFormatter();

  formatter.registerStrategy({
    name: 'openhands',
    format(data: AgentPromptData): string {
      return [
        `Task: ${data.taskSeed}`,
        `Repository: ${data.repoInfo.url}`,
        `Branch: ${data.repoInfo.branch}`,
        data.previousContext ? `Previous: ${data.previousContext.summary}` : '',
      ].filter(Boolean).join('\n');
    },
  });

  formatter.registerStrategy({
    name: 'aider',
    format(data: AgentPromptData): string {
      return [
        data.taskSeed,
        `Repo: ${data.repoInfo.url} @ ${data.repoInfo.branch}`,
        data.previousContext ? `Context: ${data.previousContext.summary}` : '',
      ].filter(Boolean).join('\n');
    },
  });

  const baseData = {
    taskSeed: 'Fix the login bug on mobile devices',
    repoInfo: {
      url: 'https://github.com/org/repo.git',
      branch: 'fix/login-bug',
      defaultBranch: 'main',
    },
    workflowInstructions: {
      qualityGates: ['npm run build', 'npm test', 'npm run lint'],
      maxDiffLines: 500,
      commitMessagePattern: 'feat: <description>',
      mrDescriptionTemplate: '## Summary\n- Changes',
      staticAnalysisCommand: 'npm run lint',
    },
    mcpServers: [{ name: 'git', transport: 'sse' as const, url: 'http://localhost:3001' }],
    previousContext: {
      summary: 'Tests still failing',
      filesModified: ['src/auth.ts'],
      toolCallsSummary: ['read_file', 'write_file'],
      branchName: 'fix/login-bug',
      testOutputSnippet: 'FAIL src/auth.test.ts',
    },
  };

  it('should format a default prompt with all fields', () => {
    const result = formatter.format('claude', baseData);

    expect(result).toContain('# Task');
    expect(result).toContain('Fix the login bug on mobile devices');
    expect(result).toContain('https://github.com/org/repo.git');
    expect(result).toContain('fix/login-bug');
    expect(result).toContain('`npm run build`');
    expect(result).toContain('`npm test`');
    expect(result).toContain('`npm run lint`');
    expect(result).toContain('git (sse: http://localhost:3001)');
    expect(result).toContain('Tests still failing');
    expect(result).toContain('Security Rules');
  });

  it('should format minimal prompt', () => {
    const result = formatter.format('claude', {
      taskSeed: 'Simple task',
      repoInfo: { url: 'https://github.com/org/repo.git', branch: 'main', defaultBranch: 'main' },
      workflowInstructions: { qualityGates: [] },
      mcpServers: [],
    });

    expect(result).toContain('# Task');
    expect(result).toContain('Simple task');
    expect(result).not.toContain('Previous Attempt');
  });

  it('should format openhands prompt via registered strategy', () => {
    const result = formatter.format('openhands', baseData);

    expect(result).toContain('Task:');
    expect(result).toContain('Repository:');
    expect(result).toContain('Tests still failing');
  });

  it('should format aider prompt via registered strategy', () => {
    const result = formatter.format('aider', baseData);

    expect(result).toContain('Fix the login bug on mobile devices');
    expect(result).toContain('Repo:');
  });

  it('should fall back to default format for unknown providers', () => {
    const result = formatter.format('unknown_provider', {
      taskSeed: 'Test task',
      repoInfo: { url: 'https://github.com/org/repo.git', branch: 'main', defaultBranch: 'main' },
      workflowInstructions: { qualityGates: [] },
      mcpServers: [],
    });

    expect(result).toContain('# Task');
    expect(result).toContain('Security Rules');
  });

  it('lists registered strategies', () => {
    expect(formatter.listStrategies()).toContain('openhands');
    expect(formatter.listStrategies()).toContain('aider');
  });

  it('any provider can be registered dynamically', () => {
    formatter.registerStrategy({
      name: 'custom-agent-v3',
      format: (data) => `CUSTOM: ${data.taskSeed}`,
    });
    const result = formatter.format('custom-agent-v3', baseData);
    expect(result).toBe('CUSTOM: Fix the login bug on mobile devices');
  });
});
