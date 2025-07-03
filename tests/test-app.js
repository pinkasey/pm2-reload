const { APP_READY_MESSAGE } = require("./test-consts");
const { Command } = require("commander");

const program = new Command();

program
  .option('--sleep <ms>', 'Sleep time in milliseconds before starting', '0')
  .option('--fail', 'Exit with error after sleep');

program.parse(process.argv);

const options = program.opts();
const sleep = parseInt(options.sleep, 10) || 0;
const fail = !!options.fail;

console.log('App Started with args', process.argv.slice(2));

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
