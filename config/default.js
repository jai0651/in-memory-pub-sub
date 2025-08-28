/**
 * Default Configuration for Pub/Sub System
 * 
 * Environment variables can override these defaults:
 * - PORT: Server port
 * - HOST: Server host
 * - LOG_LEVEL: Logging level
 * - MAX_MESSAGES_PER_TOPIC: Maximum messages to store per topic
 * - MAX_QUEUE_SIZE: Maximum WebSocket buffer size
 * - BACKPRESSURE_POLICY: Backpressure handling policy
 * - HEARTBEAT_INTERVAL: Heartbeat interval in milliseconds
 */

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }
  },

  // Pub/Sub engine configuration
  pubsub: {
    maxMessagesPerTopic: parseInt(process.env.MAX_MESSAGES_PER_TOPIC) || 100,
    maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE) || 1000,
    backpressurePolicy: process.env.BACKPRESSURE_POLICY || 'drop_oldest', // 'drop_oldest' or 'disconnect'
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filename: process.env.LOG_FILE || 'logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  },

  // WebSocket configuration
  websocket: {
    path: '/ws',
    pingInterval: 30000,
    pingTimeout: 5000
  },

  // Security configuration
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  },

  // Development configuration
  development: {
    hotReload: process.env.NODE_ENV === 'development',
    debug: process.env.DEBUG === 'true'
  }
};
