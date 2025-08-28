const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

// Import our modules
const PubSubEngine = require('./pubsub/pubsub');
const WebSocketHandler = require('./ws/websocket');
const TopicRoutes = require('./routes/topics');
const SystemRoutes = require('./routes/system');
const { defaultLogger } = require('./utils/logger');

/**
 * Main Server Application
 * 
 * Integrates:
 * - Express.js HTTP server
 * - WebSocket server
 * - Pub/Sub engine
 * - REST API routes
 * - Graceful shutdown handling
 */

class PubSubServer {
  constructor(options = {}) {
    this.options = {
      port: options.port || process.env.PORT || 3000,
      host: options.host || process.env.HOST || '0.0.0.0',
      maxMessagesPerTopic: options.maxMessagesPerTopic || 100,
      maxQueueSize: options.maxQueueSize || 1000,
      backpressurePolicy: options.backpressurePolicy || 'drop_oldest',
      heartbeatInterval: options.heartbeatInterval || 30000,
      ...options
    };

    this.logger = defaultLogger;
    this.app = null;
    this.server = null;
    this.wss = null;
    this.pubsubEngine = null;
    this.wsHandler = null;
    this.isShuttingDown = false;
  }

  /**
   * Initialize the server
   */
  async initialize() {
    try {
      this.logger.info('Initializing Pub/Sub server...');

      // Create Pub/Sub engine
      this.pubsubEngine = new PubSubEngine({
        maxMessagesPerTopic: this.options.maxMessagesPerTopic,
        maxQueueSize: this.options.maxQueueSize,
        backpressurePolicy: this.options.backpressurePolicy,
        heartbeatInterval: this.options.heartbeatInterval
      });

      // Create Express app
      this.app = express();
      this.setupExpress();

      // Create HTTP server
      this.server = http.createServer(this.app);

      // Create WebSocket server
      this.wss = new WebSocket.Server({ 
        server: this.server,
        path: '/ws'
      });

      // Create WebSocket handler
      this.wsHandler = new WebSocketHandler(this.pubsubEngine, this.logger);

      // Set up WebSocket server
      this.setupWebSocket();

      // Set up Pub/Sub event handlers
      this.setupPubSubEvents();

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      this.logger.info('Server initialization complete');
    } catch (error) {
      this.logger.error('Failed to initialize server', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Set up Express middleware and routes
   */
  setupExpress() {
    // Middleware
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.logRequest(req, res, duration);
      });

      next();
    });

    // Health check endpoint is handled by SystemRoutes

    // API routes
    const topicRoutes = new TopicRoutes(this.pubsubEngine, this.logger);
    const systemRoutes = new SystemRoutes(this.pubsubEngine, this.wsHandler, this.logger);

    this.app.use('/topics', topicRoutes.getRouter());
    this.app.use('/', systemRoutes.getRouter());

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        ts: new Date().toISOString()
      });
    });

    // Error handler
    this.app.use((error, req, res, next) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      res.status(500).json({
        error: 'INTERNAL',
        message: 'Internal server error',
        ts: new Date().toISOString()
      });
    });
  }

  /**
   * Set up WebSocket server
   */
  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      if (this.isShuttingDown) {
        ws.close(1013, 'Server shutting down');
        return;
      }

      this.wsHandler.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error', {
        error: error.message,
        stack: error.stack
      });
    });

    this.logger.info('WebSocket server initialized on /ws');
  }

  /**
   * Set up Pub/Sub event handlers
   */
  setupPubSubEvents() {
    // Topic events
    this.pubsubEngine.on('topicCreated', (topicName) => {
      this.logger.logPubSubEvent('topic created', topicName);
    });

    this.pubsubEngine.on('topicDeleted', (topicName) => {
      this.logger.logPubSubEvent('topic deleted', topicName);
    });

    this.pubsubEngine.on('clientSubscribed', (topicName, clientId) => {
      this.logger.logPubSubEvent('client subscribed', topicName, { clientId });
    });

    this.pubsubEngine.on('clientUnsubscribed', (topicName, clientId) => {
      this.logger.logPubSubEvent('client unsubscribed', topicName, { clientId });
    });

    this.pubsubEngine.on('messagePublished', (topicName, message, deliveryResults) => {
      this.logger.logPubSubEvent('message published', topicName, {
        messageId: message.id,
        subscribers: deliveryResults.length,
        successfulDeliveries: deliveryResults.filter(r => r.success).length
      });
    });

    this.pubsubEngine.on('messageDropped', (clientId, topicName, droppedMessage) => {
      this.logger.logPubSubEvent('message dropped', topicName, {
        clientId,
        droppedMessageId: droppedMessage.message?.id,
        reason: 'backpressure'
      });
    });

    // Heartbeat events
    this.pubsubEngine.on('heartbeat', () => {
      // Send heartbeat to all WebSocket clients
      this.wsHandler.broadcast({
        type: 'info',
        message: 'heartbeat',
        ts: new Date().toISOString()
      });
    });

    // Shutdown events
    this.pubsubEngine.on('shutdown', () => {
      this.logger.info('Pub/Sub engine shutdown complete');
    });
  }

  /**
   * Set up graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) {
        return;
      }

      this.isShuttingDown = true;
      this.logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new connections
        this.server.close(() => {
          this.logger.info('HTTP server closed');
        });

        // Close WebSocket connections
        if (this.wsHandler) {
          await this.wsHandler.shutdown();
        }

        // Shutdown Pub/Sub engine
        if (this.pubsubEngine) {
          await this.pubsubEngine.shutdown();
        }

        // Close logger
        this.logger.close();

        this.logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', {
          error: error.message,
          stack: error.stack
        });
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
      });
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack
      });
      shutdown('unhandledRejection');
    });
  }

  /**
   * Start the server
   */
  async start() {
    try {
      await this.initialize();

      this.server.listen(this.options.port, this.options.host, () => {
        this.logger.info(`Pub/Sub server started`, {
          host: this.options.host,
          port: this.options.port,
          pid: process.pid,
          nodeVersion: process.version,
          platform: process.platform
        });

        // Log server information
        this.logger.info(`Server endpoints:`, {
          http: `http://${this.options.host}:${this.options.port}`,
          websocket: `ws://${this.options.host}:${this.options.port}/ws`,
          health: `http://${this.options.host}:${this.options.port}/health`,
          topics: `http://${this.options.host}:${this.options.port}/topics`,
          stats: `http://${this.options.host}:${this.options.port}/stats`
        });
      });

      this.server.on('error', (error) => {
        this.logger.error('Server error', {
          error: error.message,
          stack: error.stack
        });
      });

    } catch (error) {
      this.logger.error('Failed to start server', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    if (this.isShuttingDown) {
      return;
    }

    this.logger.info('Stopping server...');
    
    if (this.server) {
      this.server.close();
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new PubSubServer();
  server.start();
}

module.exports = PubSubServer;
