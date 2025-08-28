const winston = require('winston');

/**
 * Logger Utility
 * 
 * Provides structured logging using Winston with:
 * - Console and file output
 * - JSON formatting for production
 * - Log levels: error, warn, info, debug
 * - Request correlation IDs
 * - Performance metrics
 */

class Logger {
  constructor(options = {}) {
    this.options = {
      level: options.level || 'info',
      filename: options.filename || 'logs/app.log',
      maxSize: options.maxSize || '10m',
      maxFiles: options.maxFiles || 5,
      ...options
    };

    this.logger = this.createLogger();
  }

  /**
   * Create Winston logger instance
   */
  createLogger() {
    const transports = [];

    // Console transport
    transports.push(
      new winston.transports.Console({
        level: this.options.level,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let log = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(meta).length > 0) {
              log += ` ${JSON.stringify(meta)}`;
            }
            return log;
          })
        )
      })
    );

    // File transport (if filename is provided)
    if (this.options.filename) {
      transports.push(
        new winston.transports.File({
          filename: this.options.filename,
          level: this.options.level,
          maxsize: this.parseSize(this.options.maxSize),
          maxFiles: this.options.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      );
    }

    return winston.createLogger({
      level: this.options.level,
      transports,
      exitOnError: false
    });
  }

  /**
   * Parse size string (e.g., '10m', '1g') to bytes
   */
  parseSize(sizeStr) {
    const units = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };

    const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)([bkmg])?$/);
    if (!match) {
      return 1024 * 1024; // Default to 1MB
    }

    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';
    
    return Math.floor(value * units[unit]);
  }

  /**
   * Log error message
   */
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  /**
   * Log with custom level
   */
  log(level, message, meta = {}) {
    this.logger.log(level, message, meta);
  }

  /**
   * Create a child logger with additional context
   */
  child(meta = {}) {
    const childLogger = new Logger(this.options);
    childLogger.logger = winston.child(meta);
    return childLogger;
  }

  /**
   * Log HTTP request
   */
  logRequest(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length')
    };

    if (res.statusCode >= 400) {
      this.warn(`${req.method} ${req.url} - ${res.statusCode}`, meta);
    } else {
      this.info(`${req.method} ${req.url} - ${res.statusCode}`, meta);
    }
  }

  /**
   * Log WebSocket events
   */
  logWebSocketEvent(event, clientId, meta = {}) {
    this.info(`WebSocket ${event}`, {
      clientId,
      ...meta
    });
  }

  /**
   * Log Pub/Sub events
   */
  logPubSubEvent(event, topic, meta = {}) {
    this.info(`Pub/Sub ${event}`, {
      topic,
      ...meta
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation, duration, meta = {}) {
    this.info(`Performance: ${operation}`, {
      duration: `${duration}ms`,
      ...meta
    });
  }

  /**
   * Log system events
   */
  logSystemEvent(event, meta = {}) {
    this.info(`System: ${event}`, meta);
  }

  /**
   * Get logger instance
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Close logger and flush any pending writes
   */
  close() {
    this.logger.close();
  }
}

// Create default logger instance
const defaultLogger = new Logger();

module.exports = {
  Logger,
  defaultLogger
};
