import { describe, it, expect } from 'vitest';
import { sanitizePath } from '../sandbox-executor';
import { calculateAiCost, calculateSandboxCost } from '../cost';
import { createSandboxTools } from '../tool-definitions';

describe('sanitizePath', () => {
  it('resolves relative paths within root', () => {
    expect(sanitizePath('src/index.ts', '/home/user/repo')).toBe('/home/user/repo/src/index.ts');
  });

  it('blocks path traversal', () => {
    expect(sanitizePath('../../etc/passwd', '/home/user/repo')).toBe('/home/user/repo');
  });

  it('strips special characters', () => {
    const result = sanitizePath('src/fi le$name.ts', '/home/user/repo');
    expect(result).not.toContain('$');
    expect(result).not.toContain(' ');
  });

  it('handles empty path', () => {
    expect(sanitizePath('', '/home/user/repo')).toBe('/home/user/repo');
  });
});

describe('calculateAiCost', () => {
  it('calculates input token cost', () => {
    expect(calculateAiCost(1_000_000, 0)).toBe(3.0);
  });

  it('calculates output token cost', () => {
    expect(calculateAiCost(0, 1_000_000)).toBe(15.0);
  });

  it('returns 0 for no tokens', () => {
    expect(calculateAiCost(0, 0)).toBe(0);
  });
});

describe('calculateSandboxCost', () => {
  it('calculates hourly cost', () => {
    expect(calculateSandboxCost(3_600_000, 0.05)).toBeCloseTo(0.05);
  });
});

describe('createSandboxTools', () => {
  it('creates all 5 tools', () => {
    const tools = createSandboxTools({ sandboxId: 'test-sb', credentialProxyUrl: 'http://localhost:4000' });
    expect(Object.keys(tools)).toEqual(['execute_command', 'write_file', 'read_file', 'search_files', 'list_files']);
  });

  it('each tool has description, parameters, and execute', () => {
    const tools = createSandboxTools({ sandboxId: 'test-sb' });
    for (const tool of Object.values(tools)) {
      expect(typeof tool.description).toBe('string');
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('each tool parameters has jsonSchema with properties', () => {
    const tools = createSandboxTools({ sandboxId: 'test-sb' });
    for (const tool of Object.values(tools)) {
      const params = tool.parameters as any;
      expect(params.jsonSchema).toBeDefined();
      expect(params.jsonSchema.properties).toBeDefined();
    }
  });
});
