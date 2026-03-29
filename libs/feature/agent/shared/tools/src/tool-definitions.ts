import { z } from 'zod';
import { zodSchema } from 'ai';
import { executeSandboxTool } from './sandbox-executor';

function safeZodSchema(schema: z.ZodType): ReturnType<typeof zodSchema> {
  // @ts-expect-error -- zodSchema causes TS2589 under commonjs strict mode; runtime works correctly
  return zodSchema(schema);
}

export const executeCommandSchema = z.object({
  command: z.string().describe('Shell command to execute'),
  workdir: z.string().optional().describe('Working directory (default: /home/user/repo)'),
});

export const writeFileSchema = z.object({
  path: z.string().describe('File path relative to repo root'),
  content: z.string().describe('File content'),
});

export const readFileSchema = z.object({
  path: z.string().describe('File path relative to repo root'),
});

export const searchFilesSchema = z.object({
  pattern: z.string().describe('Search pattern (regex)'),
  path: z.string().optional().describe('Directory to search (default: .)'),
  include: z.string().optional().describe('File glob pattern (e.g., *.ts)'),
});

export const listFilesSchema = z.object({
  path: z.string().optional().describe('Directory path (default: .)'),
  recursive: z.string().optional().describe('Set to "true" to list recursively'),
});

export interface SandboxToolContext {
  sandboxId: string;
  credentialProxyUrl?: string;
  onFileWrite?: () => void;
}

export function createSandboxTools(ctx: SandboxToolContext) {
  const exec = async (name: string, args: Record<string, unknown>) => {
    const result = await executeSandboxTool(name, args, ctx.sandboxId, ctx.credentialProxyUrl);
    if (result.isWrite) ctx.onFileWrite?.();
    return result.output;
  };

  return {
    execute_command: {
      description: 'Execute a shell command in the sandbox.',
      parameters: safeZodSchema(executeCommandSchema),
      execute: async (args: z.infer<typeof executeCommandSchema>) => exec('execute_command', args),
    },
    write_file: {
      description: 'Create or overwrite a file in the sandbox.',
      parameters: safeZodSchema(writeFileSchema),
      execute: async (args: z.infer<typeof writeFileSchema>) => exec('write_file', args),
    },
    read_file: {
      description: 'Read a file from the sandbox.',
      parameters: safeZodSchema(readFileSchema),
      execute: async (args: z.infer<typeof readFileSchema>) => exec('read_file', args),
    },
    search_files: {
      description: 'Search for text patterns across files using grep.',
      parameters: safeZodSchema(searchFilesSchema),
      execute: async (args: z.infer<typeof searchFilesSchema>) => exec('search_files', args),
    },
    list_files: {
      description: 'List files in a directory.',
      parameters: safeZodSchema(listFilesSchema),
      execute: async (args: z.infer<typeof listFilesSchema>) => exec('list_files', args),
    },
  };
}
