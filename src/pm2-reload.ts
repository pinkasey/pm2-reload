const pm2 = require('pm2');

const APP_NAME = 'strapi';

pm2.connect((err) => {
  if (err) {
    console.error('Failed to connect to PM2:', err);
    process.exit(1);
  }

  // Get the first process ID of the strapi app
  pm2.list((err, processList) => {
    if (err) {
      console.error('Error retrieving PM2 process list:', err);
      process.exit(1);
    }

    const firstProcess = processList.find((p) => p.name === APP_NAME);

    if (!firstProcess) {
      console.error(`Error: Could not find a process named ${APP_NAME}. Is the app running?`);
      process.exit(1);
    }

    const firstId = firstProcess.pm_id;

    console.log(`Found first instance with ID ${firstId}. Restarting it...`);

    // Restart the instance
    pm2.restart(firstId, (err) => {
      if (err) {
        console.error(`Failed to restart instance ${firstId}:`, err);
        pm2.disconnect();
        process.exit(1);
      }

      console.log(`Instance ${firstId} successfully restarted. Checking status...`);

      // Check the status of the instance after restarting
      pm2.list((err, processList) => {
        if (err) {
          console.error(`Failed to check status of instance ${firstId}:`, err);
          pm2.disconnect();
          process.exit(1);
        }

        const firstProcess = processList.find((p) => p.name === APP_NAME);
        const status = firstProcess.pm2_env.status;

        if (status !== 'online') {
          console.error(`Instance ${firstId} failed to restart successfully. Status: ${status}. Aborting reload.`);
          pm2.disconnect();
          process.exit(1);
        }

        console.log(`Instance ${firstId} is online. Proceeding to reload ${APP_NAME}...`);

        // Reload the app
        // pm2.reload("fff", (err) => {
        pm2.reload(APP_NAME, { updateEnv: true }, (err) => {
          if (err) {
            console.error(`Failed to reload ${APP_NAME}:`, err);
            pm2.disconnect();
            process.exit(1);
          }

          console.log(`${APP_NAME} reloaded successfully.`);
          pm2.disconnect();
        });
      });
    });
  });
});
