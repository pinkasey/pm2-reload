import pm2, { Proc, ProcessDescription, StartOptions } from 'pm2';
import util from 'util';

export const pm2ConnectAsync: () => Promise<void> = util.promisify(pm2.connect.bind(pm2));
export const pm2DisconnectAsync: () => Promise<void> = util.promisify(pm2.disconnect.bind(pm2));
export const pm2ListAsync: () => Promise<ProcessDescription[]> = util.promisify(pm2.list.bind(pm2));
export const pm2StartAsync: (script: string, options: StartOptions) => Promise<void> = util.promisify(pm2.start.bind(pm2));
export const pm2RestartAsync: (process: string|number) => Promise<Proc> = util.promisify(pm2.restart.bind(pm2));
export const pm2DeleteAsync: (process: string|number) => Promise<Proc> = util.promisify(pm2.delete.bind(pm2));
export const pm2DescribeAsync: (arg1: string | number) => Promise<ProcessDescription[]> = util.promisify(pm2.describe.bind(pm2));
export const pm2LaunchBusAsync: () => Promise<any> = util.promisify(pm2.launchBus.bind(pm2));
