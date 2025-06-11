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
  .helpOption('-h, --help', 'Display help for command')
  .parse(process.argv);

const APP_NAME = args.appName;
const options: CliOptions = program.opts();

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
    pm2.restart(id, (err) => (err ? reject(err) : resolve()));
  });
}

function pm2Reload(name: string, opts: object): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.reload(name, opts, (err) => (err ? reject(err) : resolve()));
  });
}

function pm2Disconnect() {
  pm2.disconnect();
}

(async () => {
  try {
    await pm2Connect();

    const processList = await pm2List();
    const firstProcess = processList.find((p) => p.name === APP_NAME);
    logger.info(`reloading ${APP_NAME}... `);

    if (!firstProcess) {
      logger.error(`Error: Could not find a process named ${APP_NAME}. Is the app running?`);
      process.exit(1);
    }

    const firstId = firstProcess.pm_id as number;
    logger.debug(`Found first instance with ID ${firstId}. Restarting it...`);

    await pm2Restart(firstId);

    logger.debug(`Instance ${firstId} successfully restarted. Checking status...`);

    const updatedList = await pm2List();
    const updatedProcess = updatedList.find((p) => p.name === APP_NAME);
    const status = updatedProcess?.pm2_env?.status;

    if (status !== 'online') {
      logger.error(`Instance ${firstId} failed to restart successfully. Status: ${status}. Aborting reload.`);
      process.exit(1);
    }

    logger.debug(`Instance ${firstId} is online. Proceeding to reload ${APP_NAME}...`);

    await pm2Reload(APP_NAME, { updateEnv: true });

    logger.info(`${APP_NAME} reloaded successfully.`);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    pm2Disconnect();
  }
})();
