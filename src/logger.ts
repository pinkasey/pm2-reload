export interface LoggerOptions {
  silent?: boolean;
  verbose?: boolean;
}

export class Logger {
  constructor(private options: LoggerOptions = {}) {}

  debug(...args: any[]) {
    if (this.options.silent || !this.options.verbose) return;
    console.debug(...args);
  }

  info(...args: any[]) {
    if (this.options.silent) return;
    console.info(...args);
  }

  warn(...args: any[]) {
    if (this.options.silent) return;
    console.warn(...args);
  }

  error(...args: any[]) {
    if (this.options.silent) return;
    console.error(...args);
  }
}
