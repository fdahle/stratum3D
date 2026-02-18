/**
 * Simple logging utility for server
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

class Logger {
  constructor(level = 'info') {
    this.level = LOG_LEVELS[level] || LOG_LEVELS.info;
  }

  _format(level, message, ...args) {
    const timestamp = new Date().toISOString();
    return `${timestamp} [${level.toUpperCase()}] ${message}`;
  }

  error(message, ...args) {
    if (this.level >= LOG_LEVELS.error) {
      console.error(this._format('error', message), ...args);
    }
  }

  warn(message, ...args) {
    if (this.level >= LOG_LEVELS.warn) {
      console.warn(this._format('warn', message), ...args);
    }
  }

  info(message, ...args) {
    if (this.level >= LOG_LEVELS.info) {
      console.log(this._format('info', message), ...args);
    }
  }

  debug(message, ...args) {
    if (this.level >= LOG_LEVELS.debug) {
      console.log(this._format('debug', message), ...args);
    }
  }
}

export const logger = new Logger(process.env.LOG_LEVEL || 'info');
export default logger;
