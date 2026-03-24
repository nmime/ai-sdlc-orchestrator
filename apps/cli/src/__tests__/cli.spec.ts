import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';

const validYaml = `
name: test-workflow
taskQueue: test-queue
steps:
  - id: plan
    type: agent
    action: plan
    on_success: implement
  - id: implement
    type: agent
    action: code
`;

const validYaml2 = `
name: test-workflow-v2
taskQueue: test-queue
steps:
  - id: plan
    type: agent
    action: plan
    on_success: review
  - id: review
    type: gate
    action: review
`;

const invalidYaml = `
name: test
steps: not-an-array
`;

describe('CLI', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;
  let readFileSyncSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('EXIT'); }) as any);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validate', () => {
    it('should print valid for correct DSL', async () => {
      readFileSyncSpy.mockReturnValue(validYaml);
      const { run } = await import('../main');
      try { run(['validate', 'test.yaml']); } catch { /* exit */ }
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('is valid'));
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should print invalid for bad DSL', async () => {
      readFileSyncSpy.mockReturnValue(invalidYaml);
      const { run } = await import('../main');
      try { run(['validate', 'bad.yaml']); } catch { /* exit */ }
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('is invalid'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should error when file not found', async () => {
      existsSyncSpy.mockReturnValue(false);
      const { run } = await import('../main');
      try { run(['validate', 'missing.yaml']); } catch { /* exit */ }
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('file not found'));
    });

    it('should error when no file provided', async () => {
      const { run } = await import('../main');
      try { run(['validate']); } catch { /* exit */ }
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('requires a file'));
    });
  });

  describe('diff', () => {
    it('should show differences between two DSL files', async () => {
      readFileSyncSpy.mockImplementation((p: any) => {
        return String(p).includes('v2') ? validYaml2 : validYaml;
      });
      const { run } = await import('../main');
      run(['diff', 'a.yaml', 'b-v2.yaml']);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Differences'));
    });

    it('should show no differences for identical files', async () => {
      readFileSyncSpy.mockReturnValue(validYaml);
      const { run } = await import('../main');
      run(['diff', 'a.yaml', 'b.yaml']);
      expect(logSpy).toHaveBeenCalledWith('No structural differences found.');
    });

    it('should error when insufficient args', async () => {
      const { run } = await import('../main');
      try { run(['diff', 'only-one.yaml']); } catch { /* exit */ }
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('requires two'));
    });
  });

  describe('drain-status', () => {
    it('should print drain status', async () => {
      const { run } = await import('../main');
      run(['drain-status']);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Drain status'));
    });
  });

  describe('usage', () => {
    it('should print usage with no args', async () => {
      const { run } = await import('../main');
      try { run([]); } catch { /* exit */ }
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
    });

    it('should print usage for unknown command', async () => {
      const { run } = await import('../main');
      try { run(['unknown']); } catch { /* exit */ }
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
    });
  });
});
