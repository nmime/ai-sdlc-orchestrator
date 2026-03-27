import { execSync } from 'child_process';

async function globalTeardown() {
  console.log('[e2e] Tearing down...');

  const vitePid = process.env.__E2E_VITE_PID__;
  if (vitePid) {
    try { process.kill(Number(vitePid), 'SIGTERM'); } catch {}
    console.log('[e2e] Vite stopped');
  }

  const backendPid = process.env.__E2E_BACKEND_PID__;
  if (backendPid) {
    try { process.kill(Number(backendPid), 'SIGTERM'); } catch {}
    console.log('[e2e] Backend stopped');
  }

  const pgId = process.env.__E2E_PG_CONTAINER_ID__;
  if (pgId) {
    try { execSync(`docker stop ${pgId}`, { encoding: 'utf-8' }); } catch {}
    console.log('[e2e] PostgreSQL stopped');
  }
}

export default globalTeardown;
