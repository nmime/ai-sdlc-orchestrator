import { PromptFormatter } from '../prompt-formatter';

describe('PromptFormatter', () => {
  const formatter = new PromptFormatter();

  it('should format a Claude prompt with all fields', () => {
    const result = formatter.format('claude_code', {
      taskId: 'task-1',
      taskTitle: 'Fix login bug',
      taskDescription: 'Login fails on mobile devices',
      repoUrl: 'https://github.com/org/repo.git',
      branch: 'fix/login-bug',
      buildCommands: ['npm run build'],
      testCommands: ['npm test'],
      lintCommands: ['npm run lint'],
      mcpServers: [{ name: 'git', endpoint: 'http://localhost:3001' }],
      previousAttemptFeedback: 'Tests still failing',
      additionalContext: 'Use TypeScript strict mode',
    });

    expect(result).toContain('# Task: Fix login bug');
    expect(result).toContain('Login fails on mobile devices');
    expect(result).toContain('https://github.com/org/repo.git');
    expect(result).toContain('fix/login-bug');
    expect(result).toContain('`npm run build`');
    expect(result).toContain('`npm test`');
    expect(result).toContain('`npm run lint`');
    expect(result).toContain('git: http://localhost:3001');
    expect(result).toContain('Tests still failing');
    expect(result).toContain('TypeScript strict mode');
    expect(result).toContain('Security Rules');
  });

  it('should format minimal prompt', () => {
    const result = formatter.format('claude_code', {
      taskId: 'task-2',
      taskTitle: 'Simple task',
      taskDescription: 'Do something',
      repoUrl: 'https://github.com/org/repo.git',
      branch: 'main',
    });

    expect(result).toContain('# Task: Simple task');
    expect(result).not.toContain('Build Commands');
    expect(result).not.toContain('Previous Attempt');
  });

  it('should format generic prompt for unknown providers', () => {
    const result = formatter.format('unknown_provider', {
      taskId: 'task-3',
      taskTitle: 'Test task',
      taskDescription: 'Test description',
      repoUrl: 'https://github.com/org/repo.git',
      branch: 'main',
    });

    expect(result).toContain('Task: Test task');
    expect(result).toContain('Description: Test description');
    expect(result).not.toContain('Security Rules');
  });
});
