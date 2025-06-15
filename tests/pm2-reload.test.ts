import { pm2Reload } from '../src/pm2-reload';
import { CliOptions } from '../src/types';
import { pm2StartAsync, pm2ListAsync, pm2DeleteAsync, pm2LaunchBusAsync, pm2DisconnectAsync } from '../src/pm2Promisified';
import path from 'path';
import { PM2BusListener } from '../src/pm2BusListener';
const { APP_READY_MESSAGE, APP_ERROR_MESSAGE } = require('./test-consts');

jest.setTimeout(10000);

const appPath = path.resolve(__dirname, 'test-app.js');

const appNamePrefix = 'test-app-';
const generateAppName = () => {
  return `${appNamePrefix}${Math.random().toString(36).substring(2, 15)}`;
};

const startTestApp = async (appName: string = generateAppName()) => {
  await pm2StartAsync(appPath, {
    script: appPath,
    name: appName,
    instances: 2, // Start with 2 instances
    autorestart: false, // Disable autorestart for testing
    args: [],
    exec_mode: 'cluster', // Use cluster mode for multiple instances
  });
  return appName;
};

// Helper to delete only test processes
const deleteTestProcesses = async () => {
  const list = await pm2ListAsync();

  const testApps = list.filter((proc: any) => proc.name && proc.name.startsWith(appNamePrefix));
  const testAppNames = [...new Set(testApps.map((proc: any) => proc.name))];
  console.log('Deleting test PM2 processes:', testAppNames.join(', '));
  for (const appName of testAppNames) {
    await pm2DeleteAsync(appName);
  }
  console.log('All test PM2 processes deleted.');
};

const pm2ReloadOptions: CliOptions = {
  silent: false,
  verbose: true,
  readyMessage: APP_READY_MESSAGE,
  failMessage: [APP_ERROR_MESSAGE],
  processTimeout: 2000,
};

async function pm2ReloadForTest(appName: string, options: CliOptions = pm2ReloadOptions): Promise<void> {
  return await pm2Reload(appName, options, false);
}

describe('PM2 Reload Functionality', () => {
  let bus: any;

  beforeAll(async () => {
    console.log('beforeAll...');
    // await pm2ConnectAsync();
    bus = await pm2LaunchBusAsync();
    console.log('beforeAll... connected.');
  });

  afterAll(async () => {
    console.log('afterAll...');
    await deleteTestProcesses();
    if (bus) bus.close();
    await pm2DisconnectAsync();
    console.log('afterAll... completed.');
  });

  test('should reload the application successfully', async () => {
    console.log('starting test');
    let pm2Listener: PM2BusListener = null as any;
    const appName = await startTestApp();
    pm2Listener = new PM2BusListener(bus, appName);
    pm2Listener.startListening();
    await pm2ReloadForTest(appName);
    console.log('executed pm2-reload.js');

    expect(pm2Listener.hasMessage(APP_READY_MESSAGE)).toBe(true);
    expect(pm2Listener.getErrors()).toHaveLength(0);
  });

  test('should handle non-existent app gracefully', async () => {
    const nonExistentApp = 'non-existent-app';
    try {
      await pm2ReloadForTest(nonExistentApp);
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('Error: Could not find a process named ' + nonExistentApp);
    }
  });

  test('should handle ready message on reload', async () => {
    const failMessages = ['FAIL', 'ERROR'];

    const appName = generateAppName();
    const pm2Listener = new PM2BusListener(bus, appName);
    pm2Listener.startListening();
    await startTestApp(appName);
    console.log(`reloading app ${appName} with ready message:`, APP_READY_MESSAGE);

    await pm2ReloadForTest(appName, {
      ...pm2ReloadOptions,
      readyMessage: APP_READY_MESSAGE,
      failMessage: failMessages,
    });

    console.log(`reloaded app ${appName} with ready message:`, APP_READY_MESSAGE);
    const messages = pm2Listener.getMessages();
    expect(pm2Listener.getErrors()).toHaveLength(0);
    expect(messages).toContain('App Started with args []');
    expect(messages).toContain(APP_READY_MESSAGE);
    expect(messages.filter((msg) => msg.includes(APP_READY_MESSAGE))).toHaveLength(4);
  });
});
