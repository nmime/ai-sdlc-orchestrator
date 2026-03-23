import { Injectable } from '@nestjs/common';
import type { AgentPromptData } from '@ai-sdlc/shared-type';

@Injectable()
export class PromptFormatter {
  format(provider: string, data: AgentPromptData): string {
    switch (provider) {
      case 'claude_code':
        return this.formatClaudePrompt(data);
      default:
        return this.formatGenericPrompt(data);
    }
  }

  private formatClaudePrompt(data: AgentPromptData): string {
    const sections: string[] = [
      `# Task: ${data.taskTitle}`,
      '',
      `## Description`,
      data.taskDescription,
      '',
      `## Repository`,
      `- URL: ${data.repoUrl}`,
      `- Branch: ${data.branch}`,
      '',
      `## Instructions`,
      '1. Clone the repository and checkout the branch',
      '2. Understand the codebase structure',
      '3. Implement the required changes',
      '4. Run all build, test, and lint commands',
      '5. Commit your changes with a clear message',
      '6. Push and create a merge request',
    ];

    if (data.buildCommands?.length) {
      sections.push('', '## Build Commands', ...data.buildCommands.map((c) => `- \`${c}\``));
    }

    if (data.testCommands?.length) {
      sections.push('', '## Test Commands', ...data.testCommands.map((c) => `- \`${c}\``));
    }

    if (data.lintCommands?.length) {
      sections.push('', '## Lint Commands', ...data.lintCommands.map((c) => `- \`${c}\``));
    }

    if (data.mcpServers?.length) {
      sections.push(
        '',
        '## Available MCP Servers',
        ...data.mcpServers.map((s) => `- ${s.name}: ${s.endpoint}`),
      );
    }

    if (data.previousAttemptFeedback) {
      sections.push(
        '',
        '## Previous Attempt Feedback',
        'Your previous attempt had issues. Please address the following:',
        data.previousAttemptFeedback,
      );
    }

    if (data.additionalContext) {
      sections.push('', '## Additional Context', data.additionalContext);
    }

    sections.push(
      '',
      '## Security Rules',
      '- Do NOT access credentials directly. Use the credential proxy.',
      '- Do NOT execute commands outside the workspace directory.',
      '- Do NOT modify files outside the repository.',
      '- Report any suspicious patterns in the codebase.',
    );

    return sections.join('\n');
  }

  private formatGenericPrompt(data: AgentPromptData): string {
    return [
      `Task: ${data.taskTitle}`,
      `Description: ${data.taskDescription}`,
      `Repository: ${data.repoUrl}`,
      `Branch: ${data.branch}`,
    ].join('\n');
  }
}
