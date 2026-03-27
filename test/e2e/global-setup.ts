import { ChildProcess, spawn, execSync } from 'child_process';
import * as net from 'net';

let backendProcess: ChildProcess;
let viteProcess: ChildProcess;
let pgContainerId: string;

const SWC_NODE = ['--no-experimental-strip-types', '--require', '@swc-node/register'];

function waitForPort(port: number, host = '127.0.0.1', timeoutMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = () => {
      const sock = new net.Socket();
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Port ${port} not available after ${timeoutMs}ms`));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
      sock.connect(port, host);
    };
    tryConnect();
  });
}

function waitForHealthy(url: string, timeoutMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryFetch = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) { resolve(); return; }
      } catch {}
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`${url} not healthy after ${timeoutMs}ms`));
      } else {
        setTimeout(tryFetch, 1000);
      }
    };
    tryFetch();
  });
}

async function globalSetup() {
  const pgPort = 54320 + Math.floor(Math.random() * 100);

  console.log('[e2e] Starting PostgreSQL container...');
  pgContainerId = execSync(
    `docker run -d --rm -e POSTGRES_DB=test_e2e -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -p ${pgPort}:5432 postgres:17`,
    { encoding: 'utf-8' }
  ).trim();
  console.log(`[e2e] PostgreSQL container: ${pgContainerId.slice(0, 12)}, port ${pgPort}`);

  await waitForPort(pgPort);
  await new Promise(r => setTimeout(r, 2000));

  console.log('[e2e] Running migrations + seed...');
  execSync(
    `node ${SWC_NODE.join(' ')} test/e2e/migrate-and-seed.ts`,
    {
      cwd: process.cwd(),
      encoding: 'utf-8',
      env: {
        ...process.env,
        DATABASE_HOST: '127.0.0.1',
        DATABASE_PORT: String(pgPort),
        DATABASE_NAME: 'test_e2e',
        DATABASE_USER: 'test',
        DATABASE_PASSWORD: 'test',
      },
      stdio: 'inherit',
    }
  );

  console.log('[e2e] Starting NestJS backend...');
  backendProcess = spawn('node', [...SWC_NODE, 'test/e2e/server.ts'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: {
      ...process.env,
      DATABASE_HOST: '127.0.0.1',
      DATABASE_PORT: String(pgPort),
      DATABASE_NAME: 'test_e2e',
      DATABASE_USER: 'test',
      DATABASE_PASSWORD: 'test',
    },
  });
  backendProcess.stdout?.on('data', (d: Buffer) => process.stdout.write(`[api] ${d}`));
  backendProcess.stderr?.on('data', (d: Buffer) => process.stderr.write(`[api:err] ${d}`));

  await waitForHealthy('http://localhost:3333/api/v1/health/live', 60_000);
  console.log('[e2e] NestJS backend ready on port 3000');

  console.log('[e2e] Starting Vite dev server...');
  viteProcess = spawn('npx', ['vite', '--port', '5174', '--host', '0.0.0.0'], {
    cwd: `${process.cwd()}/apps/dashboard`,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: "development", VITE_BACKEND_PORT: "3333" },
  });
  viteProcess.stdout?.on('data', (d: Buffer) => process.stdout.write(`[vite] ${d}`));
  viteProcess.stderr?.on('data', (d: Buffer) => process.stderr.write(`[vite:err] ${d}`));

  await waitForPort(5174);
  console.log('[e2e] Vite dev server ready on port 5173');

  process.env.__E2E_PG_CONTAINER_ID__ = pgContainerId;
  process.env.__E2E_BACKEND_PID__ = String(backendProcess.pid);
  process.env.__E2E_VITE_PID__ = String(viteProcess.pid);
}

export default globalSetup;
