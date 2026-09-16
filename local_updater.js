const express = require('express');
const { spawn } = require('child_process');

const app = express();
const PORT = Number(process.env.UPDATER_PORT || 3099);
const PROJECT_DIR = __dirname;
const TEST_MODE = process.env.UPDATER_TEST_MODE === '1';
const ALLOWED_ORIGINS = new Set([
  'https://performance-dashboard-kvj8.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3099',
  'http://127.0.0.1:3099',
]);

let currentRun = null;
const clients = new Set();
const history = [];

function addHistory(event) {
  const entry = {
    time: new Date().toISOString(),
    ...event,
  };
  history.push(entry);
  while (history.length > 200) history.shift();
  for (const client of clients) {
    client.write(`data: ${JSON.stringify(entry)}\n\n`);
  }
}

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function cors(req, res, next) {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

function runState() {
  if (!currentRun) {
    return { running: false, stage: 'idle', progress: 0, message: 'Updater is ready.' };
  }
  const terminalStages = new Set(['complete', 'failed', 'cancelled']);
  return {
    running: !terminalStages.has(currentRun.stage),
    stage: currentRun.stage,
    progress: currentRun.progress,
    message: currentRun.message,
    startedAt: currentRun.startedAt,
  };
}

function emitProgressFromLine(line) {
  const processMatch = line.match(/Processing .*?\bKL\s*0?(\d{1,2})\b/i);
  const savedMatch = line.match(/Successfully saved KL(\d{1,2})\.xlsx/i);
  if (processMatch) {
    const rto = Number(processMatch[1]);
    currentRun.stage = 'download';
    currentRun.progress = Math.max(currentRun.progress, Math.min(90, Math.round(((rto - 1) / 86) * 90)));
    currentRun.message = `Downloading KL${rto}`;
  } else if (savedMatch) {
    const rto = Number(savedMatch[1]);
    currentRun.stage = 'download';
    currentRun.progress = Math.max(currentRun.progress, Math.min(90, Math.round((rto / 86) * 90)));
    currentRun.message = `Downloaded ${rto}/86 RTO reports`;
  } else if (line.includes('Integrating reports')) {
    currentRun.stage = 'integrate';
    currentRun.progress = Math.max(currentRun.progress, 92);
    currentRun.message = 'Integrating reports into dashboard data';
  } else if (line.includes('Integration complete')) {
    currentRun.stage = 'publish';
    currentRun.progress = Math.max(currentRun.progress, 96);
    currentRun.message = 'Preparing validated files for publish';
  }
  addHistory({ type: 'log', line, state: runState() });
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    addHistory({ type: 'command', line: `${command} ${args.join(' ')}` });
    const child = spawn(command, args, {
      cwd: PROJECT_DIR,
      shell: false,
      windowsHide: true,
    });
    currentRun.child = child;

    child.stdout.on('data', (chunk) => {
      chunk.toString().split(/\r?\n/).filter(Boolean).forEach(emitProgressFromLine);
    });

    child.stderr.on('data', (chunk) => {
      chunk.toString().split(/\r?\n/).filter(Boolean).forEach(emitProgressFromLine);
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      currentRun.child = null;
      if (currentRun.cancelled) return reject(new Error('Run cancelled'));
      if (code === 0) return resolve();
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function captureCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_DIR,
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function ensureGitIdentity() {
  const name = await captureCommand('git', ['config', '--get', 'user.name']);
  const email = await captureCommand('git', ['config', '--get', 'user.email']);
  if (name.code !== 0 || !name.stdout) {
    await runCommand('git', ['config', 'user.name', 'Nippon Toyota Automation']);
  }
  if (email.code !== 0 || !email.stdout) {
    await runCommand('git', ['config', 'user.email', 'automation@nippon.local']);
  }
}

async function verifyPublishPrereqs() {
  currentRun.stage = 'preflight';
  currentRun.progress = 2;
  currentRun.message = 'Checking Git publish access';
  addHistory({ type: 'state', state: runState() });

  const status = await captureCommand('git', ['status', '--porcelain', '--untracked-files=no']);
  if (status.code !== 0) {
    throw new Error(status.stderr || 'Git status check failed');
  }
  if (status.stdout) {
    throw new Error('This repo has local tracked edits. Commit, stash, or reset them before running the updater.');
  }

  await ensureGitIdentity();
  await runCommand('git', ['push', '--dry-run', 'origin', 'HEAD:master']);
}

async function publishValidatedData() {
  currentRun.stage = 'validate';
  currentRun.progress = 94;
  currentRun.message = 'Validating generated dashboard data';
  addHistory({ type: 'state', state: runState() });

  await runCommand('python', ['automation/validate_dashboard_data.py', '--require-vahan-workbook']);
  await runCommand('git', ['diff', '--check']);

  currentRun.stage = 'publish';
  currentRun.progress = 97;
  currentRun.message = 'Committing dashboard data';
  addHistory({ type: 'state', state: runState() });

  await runCommand('git', ['add', '--', 'VAHAN_KERALA_MASTER1.xlsm', 'MASTER_DATA_2026.xlsm', 'RTO_2025_2026_Combined.csv', 'rto_data.json', 'index.html']);

  const diff = spawn('git', ['diff', '--cached', '--quiet'], {
    cwd: PROJECT_DIR,
    shell: false,
    windowsHide: true,
  });
  const hasChanges = await new Promise((resolve) => {
    diff.on('exit', (code) => resolve(code === 1));
  });

  if (!hasChanges) {
    currentRun.message = 'No data changes detected after validation';
    return;
  }

  await ensureGitIdentity();
  await runCommand('git', ['commit', '-m', 'chore: refresh Vahan dashboard data']);

  currentRun.stage = 'push';
  currentRun.progress = 99;
  currentRun.message = 'Pushing refreshed data to GitHub';
  addHistory({ type: 'state', state: runState() });
  await runCommand('git', ['push', 'origin', 'HEAD:master']);
}

async function startTestRun() {
  currentRun = {
    startedAt: new Date().toISOString(),
    stage: 'test',
    progress: 1,
    message: 'Starting updater test run',
    child: null,
    cancelled: false,
  };
  addHistory({ type: 'state', state: runState() });

  for (let i = 1; i <= 5; i += 1) {
    if (!currentRun || currentRun.cancelled) break;
    currentRun.progress = i * 20;
    currentRun.message = `Updater test step ${i}/5`;
    addHistory({ type: 'log', line: currentRun.message, state: runState() });
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  if (currentRun && !currentRun.cancelled) {
    currentRun.stage = 'complete';
    currentRun.progress = 100;
    currentRun.message = 'Updater test completed';
    addHistory({ type: 'done', state: runState() });
  }
  setTimeout(() => {
    currentRun = null;
    addHistory({ type: 'state', state: runState() });
  }, 5000);
}

async function startRun() {
  currentRun = {
    startedAt: new Date().toISOString(),
    stage: 'download',
    progress: 1,
    message: 'Starting Vahan refresh',
    child: null,
    cancelled: false,
  };
  addHistory({ type: 'state', state: runState() });

  try {
    await verifyPublishPrereqs();
    await runCommand('python', ['automation/run_full_pipeline.py']);
    await publishValidatedData();
    currentRun.progress = 100;
    currentRun.stage = 'complete';
    currentRun.message = 'Published. Render will deploy the pushed commit.';
    addHistory({ type: 'done', state: runState() });
  } catch (error) {
    const cancelled = currentRun && currentRun.cancelled;
    currentRun.stage = cancelled ? 'cancelled' : 'failed';
    currentRun.message = cancelled ? 'Refresh cancelled' : error.message;
    addHistory({ type: cancelled ? 'cancelled' : 'error', error: currentRun.message, state: runState() });
  } finally {
    setTimeout(() => {
      currentRun = null;
      addHistory({ type: 'state', state: runState() });
    }, 5000);
  }
}

app.use(express.json());
app.use(cors);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'nippon-vahan-updater', state: runState() });
});

app.get('/state', (req, res) => {
  res.json({ state: runState(), history });
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  clients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'hello', state: runState() })}\n\n`);
  req.on('close', () => clients.delete(res));
});

app.post('/start', (req, res) => {
  if (currentRun && runState().running) {
    return res.status(409).json({ error: 'A refresh is already running', state: runState() });
  }
  if (TEST_MODE) {
    startTestRun();
  } else {
    startRun();
  }
  res.status(202).json({ state: runState() });
});

app.post('/cancel', (req, res) => {
  if (!currentRun || !currentRun.child) {
    return res.status(409).json({ error: 'No running refresh to cancel', state: runState() });
  }
  currentRun.cancelled = true;
  currentRun.message = 'Cancelling refresh';
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(currentRun.child.pid), '/T', '/F'], { windowsHide: true });
  } else {
    currentRun.child.kill('SIGTERM');
  }
  addHistory({ type: 'state', state: runState() });
  res.json({ state: runState() });
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Nippon Vahan Updater listening on http://127.0.0.1:${PORT}`);
  console.log('Open the production dashboard and click Update data.');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. The updater may already be running.`);
    console.error('Close the other updater terminal, or use that running updater from the dashboard.');
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
