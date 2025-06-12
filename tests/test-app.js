const { APP_READY_MESSAGE } = require("./test-consts");

const args = process.argv.slice(2);
let sleep = 0;
let fail = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--sleep' && args[i + 1]) {
    sleep = parseInt(args[i + 1], 10) || 0;
    i++;
  }
  if (args[i] === '--fail') {
    fail = true;
  }
}

console.log('App Started with args', args);

setTimeout(() => {
  if (fail) {
    process.exit(1);
  } else {
    console.log(APP_READY_MESSAGE);
    // Keep the process running like a server
    setInterval(() => {
      console.log('App is still running...');
    }, 1000);
  }
}, sleep);
