import * as path from 'path';

const SANDBOX_ROOT = '/home/user/repo';

export function sanitizePath(userPath: string, root: string = SANDBOX_ROOT): string {
  const resolved = path.resolve(root, String(userPath || '.').replace(/[^a-zA-Z0-9._\-/]/g, ''));
  if (!resolved.startsWith(root)) return root;
  return resolved;
}

export async function executeSandboxTool(
  name: string,
  args: Record<string, unknown>,
  sandboxId: string,
  credentialProxyUrl?: string,
): Promise<{ output: string; isWrite: boolean }> {
  const baseUrl = credentialProxyUrl || 'http://localhost:4000';
  let isWrite = false;

  switch (name) {
    case 'execute_command': {
      const res = await fetch(`${baseUrl}/internal/sandbox/${sandboxId}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: args['command'], workdir: args['workdir'] || SANDBOX_ROOT }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) return { output: `HTTP ${res.status}: ${await res.text()}`, isWrite: false };
      const result = await res.json() as { stdout: string; stderr: string; exitCode: number };
      return {
        output: `exit_code=${result.exitCode}\n${result.stdout}${result.stderr ? `\nSTDERR:\n${result.stderr}` : ''}`,
        isWrite: false,
      };
    }
    case 'write_file': {
      const safePath = sanitizePath(String(args['path'] || ''));
      const res = await fetch(`${baseUrl}/internal/sandbox/${sandboxId}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: safePath, content: args['content'] }),
        signal: AbortSignal.timeout(30_000),
      });
      isWrite = true;
      return { output: res.ok ? `Written: ${safePath}` : `Failed: ${await res.text()}`, isWrite };
    }
    case 'read_file': {
      const safePath = sanitizePath(String(args['path'] || ''));
      const res = await fetch(`${baseUrl}/internal/sandbox/${sandboxId}/read?path=${encodeURIComponent(safePath)}`, {
        signal: AbortSignal.timeout(30_000),
      });
      return { output: res.ok ? await res.text() : `Failed: ${await res.text()}`, isWrite: false };
    }
    case 'search_files': {
      const safePattern = String(args['pattern']).replace(/'/g, "'\\''").replace(/[`$\\]/g, '\\$&');
      const safeInclude = args['include'] ? `--include=${String(args['include']).replace(/[^a-zA-Z0-9.*?_\-/]/g, '')}` : '';
      const safePath = sanitizePath(String(args['path'] || '.'));
      const cmd = `grep -rn ${safeInclude} -- '${safePattern}' '${safePath}' | head -50`;
      return executeSandboxTool('execute_command', { command: cmd }, sandboxId, credentialProxyUrl);
    }
    case 'list_files': {
      const safePath = sanitizePath(String(args['path'] || '.'));
      const cmd = args['recursive'] === 'true' || args['recursive'] === true
        ? `find '${safePath}' -type f | head -100`
        : `ls -la '${safePath}'`;
      return executeSandboxTool('execute_command', { command: cmd }, sandboxId, credentialProxyUrl);
    }
    default:
      return { output: `Unknown tool: ${name}`, isWrite: false };
  }
}
