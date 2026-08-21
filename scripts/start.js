import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const serverDir = path.join(root, 'server');

const noOpen = process.argv.includes('--no-open');

function waitForHealth(url, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const res = await fetch(url);
        if (res.ok) return resolve(undefined);
      } catch {
        // not ready
      }
      if (attempts >= maxAttempts) {
        return reject(new Error('Server did not become ready in time'));
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

const server = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], {
  cwd: serverDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.kill();
  vite.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('\n  Starting Kiwi (backend + frontend)…\n');

waitForHealth('http://localhost:3001/api/health')
  .then(() => {
    console.log('\n  Kiwi is ready at http://localhost:3000\n');
    if (!noOpen && process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', 'http://localhost:3000'], { detached: true, stdio: 'ignore' });
    }
  })
  .catch((err) => {
    console.warn('\n  Warning:', err.message);
    console.warn('  Frontend may still be starting at http://localhost:3000\n');
  });

server.on('exit', (code) => {
  if (!shuttingDown) {
    console.error('Backend exited with code', code);
    shutdown();
  }
});

vite.on('exit', (code) => {
  if (!shuttingDown) {
    console.error('Frontend exited with code', code);
    shutdown();
  }
});
