import { Command } from 'commander';
import { Logger } from './logger';
import { PM2BusListener } from './pm2BusListener';
import { CliOptions } from './types';
import { pm2DisconnectAsync, pm2LaunchBusAsync, pm2ListAsync, pm2RestartAsync } from './pm2Promisified';

function pm2Restart(id: number, processTimeout: number): Promise<void> {
  return new Promise(async (resolve, reject) => {
    let completed = false;
    const timer = setTimeout(() => {
      if (completed) return;
      completed = true;
      reject(new Error(`Timeout waiting for process ${id} to restart`));
    }, processTimeout);

    try {
      await pm2RestartAsync(id);
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      resolve();
    } catch (err) {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      reject(err);
    }
  });
}

async function waitForReadyOnBus(
  bus: any,
  namespace: string,
  pm_id: number,
  processTimeout: number,
  logger: Logger,
  readyMessage?: string,
  failMessages?: string[]
): Promise<void> {
  if (!readyMessage) {
    throw new Error('No ready message specified. Use --ready-message option to specify a message to wait for.');
  }

  let pm2Listener = new PM2BusListener(bus, namespace, pm_id, logger);
  try {
    pm2Listener.startListening();
    const found = await pm2Listener.waitForMessages([readyMessage, ...(failMessages || [])], processTimeout);
    if (!found) {
      throw new Error(`Timeout waiting for ready message on pm_id ${pm_id}`);
    }
    if (found.includes(readyMessage)) {
      return;
    }
    throw new Error(`Received error message on pm_id ${pm_id}: "${found}"`);
  } finally {
    pm2Listener.stopListening();
  }
}

export async function pm2Reload(
  appName: string,
  options: CliOptions,
  disconnectWhenDone = true,
  logger: Logger = new Logger(options)
): Promise<void> {
  const readyMessage = options.readyMessage;
  const failMessages = options.failMessage;
  const processTimeout = options.processTimeout * 1000; // Convert seconds to milliseconds

  let bus: any;
  try {
    bus = await pm2LaunchBusAsync();

    const processList = await pm2ListAsync();
    const appProcesses = processList.filter((p) => p.name === appName);

    if (appProcesses.length === 0) {
      throw new Error(`Error: Could not find a process named ${appName}. Is the app running?`);
    }

    logger.info(`Reloading ${appName} (${appProcesses.length} instance(s))...`);

    // Restart each instance one by one, waiting for ready message if needed
    for (const proc of appProcesses) {
      const pm_id = proc.pm_id as number;
      logger.info(`Restarting instance with ID ${pm_id}...`);

      if (readyMessage) {
        logger.debug(`Waiting for ready message on instance ${pm_id}...`);
        // Start listening before restart
        const readyPromise = waitForReadyOnBus(bus, appName, pm_id, processTimeout, logger, readyMessage, failMessages);
        await pm2Restart(pm_id, processTimeout);
        await readyPromise;
        logger.debug(`Ready message received for instance ${pm_id}.`);
      } else {
        await pm2Restart(pm_id, processTimeout);
        let status = '';
        for (let i = 0; i < 30; i++) {
          const updatedList = await pm2ListAsync();
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

    logger.info(`${appName} reloaded successfully.`);
  } finally {
    if (disconnectWhenDone) {
      if (bus) bus.close();
      await pm2DisconnectAsync();
    }
  }
}

// CLI entrypoint
if (require.main === module) {
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
    .option(
      '-f, --fail-message <string>',
      'If this message appears in stdout after restart, fail immediately. Can be specified multiple times.',
      (value, previous) => {
        const newValue = previous || [];
        newValue.push(value);
        return newValue;
      },
      [] as string[]
    )
    .option('-t, --process-timout <number>', 'How long to wait for a process to reload, in seconds', parseInt, 120)
    .helpOption('-h, --help', 'Display help for command')
    .parse(process.argv);

  const APP_NAME = args.appName;
  const options: CliOptions = program.opts();
  const logger = new Logger(options);

  (async () => {
    try {
      await pm2Reload(APP_NAME, options, false, logger);
    } catch (err) {
      logger.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  })();
}
