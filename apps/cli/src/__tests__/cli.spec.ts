import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const validYaml = `
version: 1
name: test-workflow
taskQueue: test-queue
steps:
  - id: plan
    type: auto
    action: plan
    on_success: implement
  - id: implement
    type: auto
    action: code
`;

const validYaml2 = `
version: 1
name: test-workflow-v2
taskQueue: test-queue
steps:
  - id: plan
    type: auto
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

const { readFileMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
}));

vi.mock('../file-reader', () => ({
  readFile: readFileMock,
}));

import { run } from '../main';

describe('CLI', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number): never => { throw new Error('EXIT'); });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    readFileMock.mockReset();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('validate', () => {
    it('should print valid for correct DSL', () => {
      readFileMock.mockReturnValue(validYaml);
      try { run(['validate', 'test.yaml']); } catch { /* exit */ }
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('is valid'));
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should print invalid for bad DSL', () => {
      readFileMock.mockReturnValue(invalidYaml);
      try { run(['validate', 'bad.yaml']); } catch { /* exit */ }
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('is invalid'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should error when file not found', () => {
      readFileMock.mockImplementation(() => {
        console.error('Error: file not found: /resolved/missing.yaml');
        process.exit(1);
      });
      try { run(['validate', 'missing.yaml']); } catch { /* exit */ }
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('file not found'));
    });

    it('should error when no file provided', () => {
      try { run(['validate']); } catch { /* exit */ }
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('requires a file'));
    });
  });

  describe('diff', () => {
    it('should show differences between two DSL files', () => {
      readFileMock
        .mockReturnValueOnce(validYaml)
        .mockReturnValueOnce(validYaml2);
      try { run(['diff', 'a.yaml', 'b-v2.yaml']); } catch { /* exit */ }
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Differences'));
    });

    it('should show no differences for identical files', () => {
      readFileMock.mockReturnValue(validYaml);
      try { run(['diff', 'a.yaml', 'b.yaml']); } catch { /* exit */ }
      expect(logSpy).toHaveBeenCalledWith('No structural differences found.');
    });

    it('should error when insufficient args', () => {
      try { run(['diff', 'only-one.yaml']); } catch { /* exit */ }
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('requires two'));
    });
  });

  describe('drain-status', () => {
    it('should print drain status', () => {
      try { run(['drain-status']); } catch { /* exit */ }
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Drain status'));
    });
  });

  describe('usage', () => {
    it('should print usage with no args', () => {
      try { run([]); } catch { /* exit */ }
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
    });

    it('should print usage for unknown command', () => {
      try { run(['unknown']); } catch { /* exit */ }
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
    });
  });
});
