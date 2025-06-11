import pm2, { ProcessDescription } from 'pm2';

const APP_NAME = 'strapi';

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

    if (!firstProcess) {
      console.error(`Error: Could not find a process named ${APP_NAME}. Is the app running?`);
      process.exit(1);
    }

    const firstId = firstProcess.pm_id as number;
    console.log(`Found first instance with ID ${firstId}. Restarting it...`);

    await pm2Restart(firstId);

    console.log(`Instance ${firstId} successfully restarted. Checking status...`);

    const updatedList = await pm2List();
    const updatedProcess = updatedList.find((p) => p.name === APP_NAME);
    const status = updatedProcess?.pm2_env?.status;

    if (status !== 'online') {
      console.error(`Instance ${firstId} failed to restart successfully. Status: ${status}. Aborting reload.`);
      process.exit(1);
    }

    console.log(`Instance ${firstId} is online. Proceeding to reload ${APP_NAME}...`);

    await pm2Reload(APP_NAME, { updateEnv: true });

    console.log(`${APP_NAME} reloaded successfully.`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    pm2Disconnect();
  }
})();
