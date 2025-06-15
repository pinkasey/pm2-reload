import { Logger } from './logger';

class PM2BusListener {
  private bus: any;
  //if  pm_id is specified, only listen to messages for that process
  private pm_id?: number;
  private appName?: string;
  private logger: Logger;
  private receivedMessages: string[] = [];
  private errors: string[] = [];
  private handleOutLogBound: (packet: any) => void;
  private handleErrorLogBound: (packet: any) => void;
  private waitingResolvers: Array<{ messages: string[]; resolve: (msg: string) => void; reject: (err: Error) => void; timeout?: NodeJS.Timeout }> =
    [];

  constructor(bus: any, appName?: string, pm_id?: number, logger?: Logger) {
    this.bus = bus;
    this.appName = appName;
    this.pm_id = pm_id;
    this.logger = logger || (console as any);
    this.handleOutLogBound = this.handleStandardLog.bind(this);
    this.handleErrorLogBound = this.handleErrorLog.bind(this);
  }

  startListening() {
    this.logger.debug(`Listening for messages on pm_id ${this.pm_id}...`);
    this.bus.on('log:out', this.handleOutLogBound);
    this.bus.on('log:err', this.handleErrorLogBound);
    this.bus.on('process:msg', this.handleOutLogBound);
  }

  stopListening() {
    this.bus.off('log:out', this.handleOutLogBound);
    this.bus.off('log:err', this.handleErrorLogBound);
    // Optionally clear all pending resolvers
    this.waitingResolvers.forEach(({ reject }) => reject(new Error('Listener stopped before message was received')));
    this.waitingResolvers = [];
  }

  private handleErrorLog(packet: any) {
    this.handleLog(packet, 'err');
  }

  private handleStandardLog(packet: any) {
    this.handleLog(packet, 'out');
  }

  private handleLog(packet: any, type: 'out' | 'err') {
    if (typeof packet.data !== 'string') return;
    if (this.appName && packet.process?.name !== this.appName) return;
    if (this.pm_id != null && packet.process?.pm_id !== this.pm_id) return;

    if (type === 'err') {
      this.errors.push(packet.data);
    }

    const message = packet.data;
    this.receivedMessages.push(message.trim());
    this.logger.debug(`PM2BusListener [${packet.process?.name}:${packet.process?.pm_id}] Received message: ${message}`);
    // Check if any waiting promise should be resolved
    for (const waiter of this.waitingResolvers) {
      const found = waiter.messages.find((msg) => message.includes(msg));
      if (found) {
        if (waiter.timeout) clearTimeout(waiter.timeout);
        waiter.resolve(message);
      }
    }
    // Remove resolved waiters
    this.waitingResolvers = this.waitingResolvers.filter((waiter) => !waiter.messages.some((msg) => message.includes(msg)));
  }

  hasMessage(message: string): boolean {
    return this.receivedMessages.some((msg) => msg.includes(message));
  }

  getMessages(): string[] {
    return [...this.receivedMessages];
  }

  getErrors(): string[] {
    return [...this.errors];
  }

  clearMessages() {
    this.receivedMessages = [];
  }

  waitForMessages(messages: string[], timeoutMs = 10000): Promise<string> {
    return new Promise((resolve, reject) => {
      // Check if already received
      const found = this.receivedMessages.find((msg) => messages.some((m) => msg.includes(m)));
      if (found) {
        resolve(found);
        return;
      }
      // Otherwise, wait for future messages
      const timeout = setTimeout(() => {
        this.waitingResolvers = this.waitingResolvers.filter((w) => w.resolve !== resolve);
        reject(new Error(`Timeout waiting for messages: ${messages.join(', ')}`));
      }, timeoutMs);
      this.waitingResolvers.push({ messages, resolve, reject, timeout });
    });
  }
}

export { PM2BusListener };
