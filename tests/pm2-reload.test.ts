import { exec, spawn } from 'child_process';
import path from 'path';
import util from 'util';

jest.setTimeout(30000);

const execAsync = util.promisify(exec);
const appPath = path.resolve(__dirname, 'test-app.js');
const appName = 'test-app';

describe('PM2 Reload Functionality', () => {
  beforeAll(async () => {
    console.log('beforeAll: starting PM2 with test app');
    const { stdout, stderr } = await execAsync(`npx pm2 start ${appPath} --name ${appName} -i 2 --no-autorestart`);
    if (stdout) process.stdout.write(`[pm2 start stdout] ${stdout}`);
    if (stderr) process.stderr.write(`[pm2 start stderr] ${stderr}`);
  });

  afterAll(async () => {
    const { stderr } = await execAsync(`pm2 delete ${appName}`);
    if (stderr) console.error('afterAll stderr:', stderr);
  });

  test('should reload the application successfully', async () => {
    console.log('starting test');
    try {
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
});
