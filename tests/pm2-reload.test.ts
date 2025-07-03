import { exec, spawn } from 'child_process';
import path from 'path';
import util from 'util';
const { APP_READY_MESSAGE } = require('./test-consts');

jest.setTimeout(40000);

const execAsync = util.promisify(exec);
const appPath = path.resolve(__dirname, 'test-app.js');

const appNamePrefix = 'test-app-';
const generateAppName = () => {
  return `${appNamePrefix}${Math.random().toString(36).substring(2, 15)}`;
};

const startTestApp = async (
  args: {
    appName?: string;
    sleep?: number;
  } = {}
) => {
  const appName = args.appName || generateAppName();
  const sleep = args.sleep || 0;

  let command = `npx pm2 start ${appPath} --name ${appName} -i 2 --no-autorestart`;
  if (sleep > 0) {
    command += ` -- --sleep ${sleep}`;
  }
  const { stdout, stderr } = await execAsync(command);
  if (stdout) process.stdout.write(`[pm2 start stdout] ${stdout}`);
  if (stderr) process.stderr.write(`[pm2 start stderr] ${stderr}`);
  return appName;
};

// Helper to delete only test processes
const deleteTestProcesses = async () => {
  const { stdout } = await execAsync(`npx pm2 jlist`);
  const list = JSON.parse(stdout);
  const testApps = list.filter((proc: any) => proc.name && proc.name.startsWith(appNamePrefix));
  const testAppNames = [...new Set(testApps.map((proc: any) => proc.name))];
  console.log('Deleting test PM2 processes:', testAppNames.join(', '));
  for (const appName of testAppNames) {
    await execAsync(`npx pm2 delete ${appName}`);
  }
  console.log('All test PM2 processes deleted.');
};

describe('PM2 Reload Functionality', () => {
  afterAll(async () => {
    await deleteTestProcesses();
    console.log('Test PM2 processes deleted.');
  });

  test('should reload the application successfully', async () => {
    console.log('starting test');
    try {
      const appName = await startTestApp();
      const { stdout, stderr } = await execAsync(`node ./dist/pm2-reload.js ${appName}`);
      console.log('executed pm2-reload.js');
      if (stderr) console.error('Test stderr:', stderr);
      expect(stderr).toBe('');
      expect(stdout).toContain('Reloading');
    } catch (error: any) {
      if (error.stdout) console.log('stdout:', error.stdout);
      if (error.stderr) console.error('stderr:', error.stderr);
      throw error;
    }
  });

  test('should handle non-existent app gracefully', async () => {
    try {
      await execAsync(`node ./dist/pm2-reload.js non-existent-app`);
    } catch (error: any) {
      expect(error.stderr).toContain('Error: Could not find a process named non-existent-app');
    }
  });

  test('should handle ready message on reload', async () => {
    const failMessages = ['FAIL', 'ERROR'];

    const appName = await startTestApp();
    const failMessageFlags = failMessages.map((f) => `--fail-message "${f}"`).join(' ');
    console.log(`reloading app ${appName} with ready message:`, APP_READY_MESSAGE);
    const { stdout, stderr } = await execAsync(`node ./dist/pm2-reload.js ${appName} --verbose --ready-message "${APP_READY_MESSAGE}"`);
    console.log(`reloaded app ${appName} with ready message:`, APP_READY_MESSAGE);
    if (stderr) console.error('Test stderr:', stderr);
    expectEmptyStdError(stderr);
    expect(stdout).toContain('Reloading');
    expect(stdout).toContain('Ready message received for instance');
    expect(stdout).toContain(`${appName} reloaded successfully.`);
  });

  test('should exit on timeout if ready message is not received', async () => {
    const appName = await startTestApp({ sleep: 10 * 1000 });
    const timeout = 2; // seconds
    try {
      await execAsync(`node ./dist/pm2-reload.js ${appName} --ready-message "${APP_READY_MESSAGE}" --process-timeout ${timeout}`);
    } catch (error: any) {
      expect(error.stderr).toContain(`Timeout waiting for ready message`);
    }
  });

  test('should start normally if timeout is specified, but not reached', async () => {
    const appName = await startTestApp({ sleep: 0 });
    const timeout = 2; // seconds
    await execAsync(`node ./dist/pm2-reload.js ${appName} --ready-message "${APP_READY_MESSAGE}" --process-timeout ${timeout}`);
  });
});
function expectEmptyStdError(stderr: string) {
  const cleanStdErr = stderr
    .replace(/Debugger attached./g, '')
    .replace(/Waiting for the debugger to disconnect.../g, '')
    .replace(/\n/g, '')
    .replace(/\s/g, '');
  expect(cleanStdErr).toBe('');
}
