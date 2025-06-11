import pm2, { ProcessDescription } from 'pm2';
import { Command } from 'commander';
import { Logger } from './logger';

const program = new Command();

const args = {
  appName: '',
};

program
  .name('pm2-reload')
  .description('Restart and reload a PM2 process safely')
  .argument('<appName>', 'Name of the PM2 app to reload', (name) => {
    args.appName = name;
  })
  .option('-s, --silent', 'Silent mode')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-m, --ready-message <string>', 'Wait for this message in stdout after restart')
  .option('-t, --process-timout <number>', 'How log to wait for a process to reload, in seconds', parseInt, 120)
  .helpOption('-h, --help', 'Display help for command')
  .parse(process.argv);

const APP_NAME = args.appName;
const options: CliOptions = program.opts();
const READY_MESSAGE = options.readyMessage;
const PROCESS_TIMEOUT = options.processTimout * 1000; // Convert seconds to milliseconds

const logger = new Logger(options);

function pm2Connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => (err ? reject(err) : resolve()));
  });
}

function pm2List(): Promise<ProcessDescription[]> {
  return new Promise((resolve, reject) => {
    pm2.list((err, list) => (err ? reject(err) : resolve(list)));
  });
}

function pm2Restart(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let completed = false;
    const timer = setTimeout(() => {
      if (completed) return; // Already resolved
      reject(new Error(`Timeout waiting for process ${id} to restart`));
    }, PROCESS_TIMEOUT);

    pm2.restart(id, (err) => {
      clearTimeout(timer);
      completed = true;
      if (err) {
        reject(err);
      } else {
        completed = true;
        resolve();
      }
    });
  });
}

function pm2Disconnect() {
  pm2.disconnect();
}

function waitForReadyMessage(pm_id: number, readyMessage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.launchBus((err, bus) => {
      if (err) return reject(err);
      let completed = false;

      const timer = setTimeout(() => {
        if (completed) return; // Already resolved
        cleanup();
        reject(new Error(`Timeout waiting for ready message on pm_id ${pm_id}`));
      }, PROCESS_TIMEOUT);

      const onLog = (packet: any) => {
        if (
          // prettier-ignore
          packet.process 
          && packet.process.pm_id === pm_id
          && typeof packet.data === 'string'
          && packet.data.includes(readyMessage)
        ) {
          completed = true;
          cleanup();
          resolve();
        }
      };

      function cleanup() {
        clearTimeout(timer);
        bus.off('log:out', onLog);
        bus.off('process:msg', onLog);
        bus.close();
      }

      bus.on('log:out', onLog);
      // Optionally listen to 'process:msg' if your app uses process.send
      // bus.on('process:msg', onLog);
    });
  });
}

(async () => {
  try {
    await pm2Connect();

    const processList = await pm2List();
    const appProcesses = processList.filter((p) => p.name === APP_NAME);

    if (appProcesses.length === 0) {
      logger.error(`Error: Could not find a process named ${APP_NAME}. Is the app running?`);
      process.exit(1);
    }

    logger.info(`Reloading ${APP_NAME} (${appProcesses.length} instance(s))...`);

    // Restart each instance one by one, waiting for ready message if needed
    for (const proc of appProcesses) {
      const pm_id = proc.pm_id as number;
      logger.info(`Restarting instance with ID ${pm_id}...`);

      if (READY_MESSAGE) {
        logger.debug(`Waiting for ready message on instance ${pm_id}...`);
        const readyPromise = waitForReadyMessage(pm_id, READY_MESSAGE);
        const restartPromise = pm2Restart(pm_id);
        await Promise.all([readyPromise, restartPromise]);
        logger.debug(`Ready message received for instance ${pm_id}.`);
      } else {
        await pm2Restart(pm_id);
        let status = '';
        for (let i = 0; i < 30; i++) {
          const updatedList = await pm2List();
          const updatedProc = updatedList.find((p) => p.pm_id === pm_id);
          status = updatedProc?.pm2_env?.status || '';
          if (status === 'online') break;
          await new Promise((res) => setTimeout(res, 1000));
        }
        if (status !== 'online') {
          logger.error(`Instance ${pm_id} failed to restart successfully. Status: ${status}. Aborting reload.`);
          process.exit(1);
        }
      }
    }

    logger.info(`${APP_NAME} reloaded successfully.`);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    pm2Disconnect();
  }
})();
