const express = require('express');

/**
 * System Management REST API Routes
 * 
 * Endpoints:
 * - GET /health - Health check
 * - GET /stats - System statistics
 * - GET /info - System information
 */

class SystemRoutes {
  constructor(pubsubEngine, wsHandler, logger) {
    this.pubsubEngine = pubsubEngine;
    this.wsHandler = wsHandler;
    this.logger = logger;
    this.router = express.Router();
    this.startTime = Date.now();
    
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check
    this.router.get('/health', this.getHealth.bind(this));
    
    // System statistics
    this.router.get('/stats', this.getStats.bind(this));
    
    // System information
    this.router.get('/info', this.getInfo.bind(this));
  }

  /**
   * GET /health
   * Health check endpoint
   * Returns: { "uptime_sec": 123, "topics": 2, "subscribers": 4 }
   */
  async getHealth(req, res) {
    try {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      const pubsubStats = this.pubsubEngine.getStats();

      // Return exactly as specified in the assignment
      const health = {
        uptime_sec: uptime,
        topics: Object.keys(pubsubStats.topics).length,
        subscribers: pubsubStats.totalSubscribers
      };

      res.status(200).json(health);
    } catch (error) {
      this.logger.error('Error in health check', {
        error: error.message,
        stack: error.stack
      });

      res.status(503).json({
        error: 'INTERNAL',
        message: 'Health check failed'
      });
    }
  }

  /**
   * GET /stats
   * System statistics endpoint
   */
  async getStats(req, res) {
    try {
      const pubsubStats = this.pubsubEngine.getStats();
      const wsStats = this.wsHandler ? this.wsHandler.getStats() : { totalClients: 0, connectionCounter: 0 };
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);

      const stats = {
        system: {
          uptime_sec: uptime,
          start_time: new Date(this.startTime).toISOString(),
          memory: this.getMemoryUsage(),
          node_version: process.version,
          platform: process.platform
        },
        topics: pubsubStats.topics,
        total_subscribers: pubsubStats.totalSubscribers,
        total_messages: pubsubStats.totalMessages,
        websocket: {
          total_clients: wsStats.totalClients || 0,
          connection_counter: wsStats.connectionCounter || 0,
          active_connections: wsStats.totalClients || 0
        },
        ts: new Date().toISOString()
      };

      res.json(stats);
    } catch (error) {
      this.logger.error('Error getting system stats', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        error: 'INTERNAL',
        message: 'Failed to retrieve system statistics',
        ts: new Date().toISOString()
      });
    }
  }

  /**
   * GET /info
   * System information endpoint
   */
  async getInfo(req, res) {
    try {
      const pubsubStats = this.pubsubEngine.getStats();
      const wsStats = this.wsHandler ? this.wsHandler.getStats() : { totalClients: 0 };
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);

      const info = {
        service: 'Plivo Pub/Sub System',
        version: '1.0.0',
        description: 'In-memory Pub/Sub system with Express.js and WebSockets',
        features: [
          'Topic-based message routing',
          'Fan-out delivery',
          'Topic isolation',
          'Message replay support',
          'Backpressure handling',
          'WebSocket protocol',
          'REST API management'
        ],
        configuration: {
          max_messages_per_topic: this.pubsubEngine.maxMessagesPerTopic,
          max_queue_size: this.pubsubEngine.maxQueueSize,
          backpressure_policy: this.pubsubEngine.backpressurePolicy,
          heartbeat_interval_ms: this.pubsubEngine.heartbeatInterval
        },
        status: {
          uptime_sec: uptime,
          start_time: new Date(this.startTime).toISOString(),
          topics_count: Object.keys(pubsubStats.topics).length,
          total_subscribers: pubsubStats.totalSubscribers,
          total_messages: pubsubStats.totalMessages,
          active_connections: wsStats.totalClients || 0
        },
        endpoints: {
          rest: {
            topics: '/topics',
            health: '/health',
            stats: '/stats',
            info: '/info'
          },
          websocket: '/ws'
        },
        protocol: {
          websocket: {
            message_types: ['subscribe', 'unsubscribe', 'publish', 'ping'],
            response_types: ['ack', 'event', 'error', 'pong', 'info']
          }
        },
        ts: new Date().toISOString()
      };

      res.json(info);
    } catch (error) {
      this.logger.error('Error getting system info', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        error: 'INTERNAL',
        message: 'Failed to retrieve system information',
        ts: new Date().toISOString()
      });
    }
  }

  /**
   * Get memory usage information
   * @returns {Object} Memory usage stats
   */
  getMemoryUsage() {
    const memUsage = process.memoryUsage();
    return {
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024 * 100) / 100 // MB
    };
  }

  /**
   * Get the Express router
   */
  getRouter() {
    return this.router;
  }
}

module.exports = SystemRoutes;
