import { Injectable } from '@nestjs/common';
import type { AgentPromptData } from '@ai-sdlc/shared-type';

@Injectable()
export class PromptFormatter {
  format(provider: string, data: AgentPromptData): string {
    switch (provider) {
      case 'claude':
        return this.formatClaudePrompt(data);
      case 'openhands':
        return this.formatOpenHandsPrompt(data);
      case 'aider':
        return this.formatAiderPrompt(data);
      default:
        return this.formatClaudePrompt(data);
    }
  }

  private formatClaudePrompt(data: AgentPromptData): string {
    const sections: string[] = [
      `# Task`,
      data.taskSeed,
      '',
      `## Repository`,
      `- URL: ${data.repoInfo.url}`,
      `- Branch: ${data.repoInfo.branch}`,
      `- Default Branch: ${data.repoInfo.defaultBranch}`,
    ];

    if (data.repoInfo.paths?.length) {
      sections.push(`- Allowed Paths: ${data.repoInfo.paths.join(', ')}`);
    }

    sections.push('', '## Instructions');
    sections.push('1. Understand the codebase structure');
    sections.push('2. Implement the required changes');
    sections.push('3. Run all quality gates');
    sections.push('4. Commit with clear messages');
    sections.push('5. Push and create a merge/pull request');

    if (data.workflowInstructions.qualityGates.length) {
      sections.push('', '## Quality Gates');
      for (const gate of data.workflowInstructions.qualityGates) {
        sections.push(`- \`${gate}\``);
      }
    }

    if (data.workflowInstructions.commitMessagePattern) {
      sections.push('', `## Commit Pattern: ${data.workflowInstructions.commitMessagePattern}`);
    }

    if (data.workflowInstructions.mrDescriptionTemplate) {
      sections.push('', '## MR Description Template', data.workflowInstructions.mrDescriptionTemplate);
    }

    if (data.workflowInstructions.maxDiffLines) {
      sections.push('', `## Max Diff Lines: ${data.workflowInstructions.maxDiffLines}`);
    }

    if (data.workflowInstructions.staticAnalysisCommand) {
      sections.push('', `## Static Analysis: \`${data.workflowInstructions.staticAnalysisCommand}\``);
    }

    if (data.mcpServers.length) {
      sections.push('', '## Available MCP Servers');
      for (const server of data.mcpServers) {
        sections.push(`- ${server.name} (${server.transport}${server.url ? ': ' + server.url : ''})`);
      }
    }

    if (data.previousContext) {
      sections.push(
        '',
        '## Previous Attempt Context',
        `Summary: ${data.previousContext.summary}`,
        `Branch: ${data.previousContext.branchName}`,
        `Files Modified: ${data.previousContext.filesModified.join(', ')}`,
      );
      if (data.previousContext.testOutputSnippet) {
        sections.push(`Test Output: ${data.previousContext.testOutputSnippet}`);
      }
      if (data.previousContext.errorCode) {
        sections.push(`Error Code: ${data.previousContext.errorCode}`);
      }
    }

    sections.push(
      '',
      '## Security Rules',
      '- Do NOT access credentials directly. Use the credential proxy.',
      '- Do NOT execute commands outside the workspace directory.',
      '- Do NOT modify files outside the repository.',
      '- Do NOT exfiltrate data or credentials.',
    );

    return sections.join('\n');
  }

  private formatOpenHandsPrompt(data: AgentPromptData): string {
    return [
      `Task: ${data.taskSeed}`,
      `Repository: ${data.repoInfo.url}`,
      `Branch: ${data.repoInfo.branch}`,
      data.previousContext ? `Previous: ${data.previousContext.summary}` : '',
    ].filter(Boolean).join('\n');
  }

  private formatAiderPrompt(data: AgentPromptData): string {
    return [
      data.taskSeed,
      `Repo: ${data.repoInfo.url} @ ${data.repoInfo.branch}`,
      data.previousContext ? `Context: ${data.previousContext.summary}` : '',
    ].filter(Boolean).join('\n');
  }
}
