const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

/**
 * WebSocket Handler for Pub/Sub System
 * 
 * Implements the WebSocket protocol:
 * - Client authentication and connection management
 * - Message validation and routing
 * - Protocol compliance with defined message types
 * - Error handling and client feedback
 */

class WebSocketHandler {
  constructor(pubsubEngine, logger) {
    this.pubsubEngine = pubsubEngine;
    this.logger = logger;
    this.clients = new Map(); // clientId -> { ws, topics, connectedAt }
    this.connectionCounter = 0;
    
    // Bind methods
    this.handleConnection = this.handleConnection.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} req - HTTP request object
   */
  handleConnection(ws, req) {
    const connectionId = this.generateClientId();
    const clientInfo = {
      ws,
      topics: new Set(),
      connectedAt: Date.now(),
      lastPing: Date.now(),
      connectionId: connectionId
    };

    this.clients.set(connectionId, clientInfo);
    this.connectionCounter++;

    this.logger.info(`WebSocket client connected: ${connectionId}`, {
      connectionId,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectionCount: this.connectionCounter
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: 'info',
      message: 'Connected to Pub/Sub system',
      ts: new Date().toISOString()
    });

    // Set up event handlers
    ws.on('message', (data) => this.handleMessage(connectionId, data));
    ws.on('close', (code, reason) => this.handleClose(connectionId, code, reason));
    ws.on('error', (error) => this.handleError(connectionId, error));

    // Set up ping/pong for connection health
    ws.on('pong', () => {
      const client = this.clients.get(connectionId);
      if (client) {
        client.lastPing = Date.now();
      }
    });

    // Send periodic ping
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // 30 seconds

    // Store ping interval for cleanup
    clientInfo.pingInterval = pingInterval;
  }

  /**
   * Handle incoming WebSocket message
   * @param {string} clientId - Client identifier
   * @param {Buffer|string} data - Raw message data
   */
  handleMessage(clientId, data) {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      this.sendError(clientId, 'BAD_REQUEST', 'Invalid JSON message');
      return;
    }

    // Validate message structure
    if (!this.validateMessage(message)) {
      this.sendError(clientId, 'BAD_REQUEST', 'Invalid message format');
      return;
    }

    const { type, topic, message: msgData, client_id, last_n, request_id } = message;

    // According to assignment: client_id is required for subscribe/unsubscribe/publish
    if ((type === 'subscribe' || type === 'unsubscribe' || type === 'publish') && !client_id) {
      this.sendError(clientId, 'BAD_REQUEST', 'client_id is required for this operation');
      return;
    }

    // Store the client-provided ID for this connection for tracking
    const client = this.clients.get(clientId);
    if (client && client_id) {
      client.clientProvidedId = client_id;
    }

    try {
      switch (type) {
        case 'subscribe':
          this.handleSubscribe(clientId, topic, last_n, request_id);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, topic, request_id);
          break;
        case 'publish':
          this.handlePublish(clientId, topic, msgData, request_id);
          break;
        case 'ping':
          this.handlePing(clientId, request_id);
          break;
        default:
          this.sendError(clientId, 'BAD_REQUEST', `Unknown message type: ${type}`);
      }
    } catch (error) {
      this.logger.error('Error handling WebSocket message', {
        clientId,
        messageType: type,
        error: error.message
      });
      this.sendError(clientId, 'INTERNAL', 'Internal server error');
    }
  }

  /**
   * Handle subscribe message
   * @param {string} clientId - Client identifier
   * @param {string} topic - Topic name
   * @param {number} lastN - Number of messages to replay
   * @param {string} requestId - Request correlation ID
   */
  handleSubscribe(clientId, topic, lastN = 0, requestId) {
    if (!topic) {
      this.sendError(clientId, 'BAD_REQUEST', 'Topic is required for subscribe');
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) {
      this.sendError(clientId, 'UNAUTHORIZED', 'Client not found');
      return;
    }

    // Use the client-provided ID for Pub/Sub operations, fallback to connection ID
    const pubsubClientId = client.clientProvidedId || clientId;
    const result = this.pubsubEngine.subscribe(topic, pubsubClientId, client.ws, lastN);
    
    if (result.success) {
      client.topics.add(topic);
      
      this.sendToClient(client.ws, {
        type: 'ack',
        request_id: requestId,
        topic: topic,
        status: 'ok',
        ts: new Date().toISOString()
      });

      this.logger.info(`Client subscribed to topic`, {
        connectionId: clientId,
        clientProvidedId: pubsubClientId,
        topic,
        lastN
      });
    } else {
      this.sendError(clientId, result.error, `Failed to subscribe to topic: ${topic}`);
    }
  }

  /**
   * Handle unsubscribe message
   * @param {string} clientId - Client identifier
   * @param {string} topic - Topic name
   * @param {string} requestId - Request correlation ID
   */
  handleUnsubscribe(clientId, topic, requestId) {
    if (!topic) {
      this.sendError(clientId, 'BAD_REQUEST', 'Topic is required for unsubscribe');
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) {
      this.sendError(clientId, 'UNAUTHORIZED', 'Client not found');
      return;
    }

    // Use the client-provided ID for Pub/Sub operations, fallback to connection ID
    const pubsubClientId = client.clientProvidedId || clientId;
    const result = this.pubsubEngine.unsubscribe(topic, pubsubClientId);
    
    if (result) {
      client.topics.delete(topic);
      
      this.sendToClient(client.ws, {
        type: 'ack',
        request_id: requestId,
        topic: topic,
        status: 'ok',
        ts: new Date().toISOString()
      });

      this.logger.info(`Client unsubscribed from topic`, {
        connectionId: clientId,
        clientProvidedId: pubsubClientId,
        topic
      });
    } else {
      this.sendError(clientId, 'TOPIC_NOT_FOUND', `Topic not found or not subscribed: ${topic}`);
    }
  }

  /**
   * Handle publish message
   * @param {string} clientId - Client identifier
   * @param {string} topic - Topic name
   * @param {Object} message - Message to publish
   * @param {string} requestId - Request correlation ID
   */
  handlePublish(clientId, topic, message, requestId) {
    if (!topic) {
      this.sendError(clientId, 'BAD_REQUEST', 'Topic is required for publish');
      return;
    }

    if (!message || !message.id || !message.payload) {
      this.sendError(clientId, 'BAD_REQUEST', 'Message must have id and payload');
      return;
    }

    const result = this.pubsubEngine.publish(topic, message);
    
    if (result.success) {
      this.sendToClient(this.clients.get(clientId).ws, {
        type: 'ack',
        request_id: requestId,
        topic: topic,
        status: 'ok',
        subscribers: result.subscribers,
        ts: new Date().toISOString()
      });

      this.logger.info(`Message published to topic`, {
        clientId,
        topic,
        messageId: message.id,
        subscribers: result.subscribers
      });
    } else {
      this.sendError(clientId, result.error, `Failed to publish to topic: ${topic}`);
    }
  }

  /**
   * Handle ping message
   * @param {string} clientId - Client identifier
   * @param {string} requestId - Request correlation ID
   */
  handlePing(clientId, requestId) {
    const client = this.clients.get(clientId);
    if (!client) {
      this.sendError(clientId, 'UNAUTHORIZED', 'Client not found');
      return;
    }

    client.lastPing = Date.now();
    
    this.sendToClient(client.ws, {
      type: 'pong',
      request_id: requestId,
      ts: new Date().toISOString()
    });
  }

  /**
   * Handle WebSocket connection close
   * @param {string} clientId - Client identifier
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  handleClose(clientId, code, reason) {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Clean up ping interval
    if (client.pingInterval) {
      clearInterval(client.pingInterval);
    }

    // Unsubscribe from all topics using the client-provided ID
    for (const topic of client.topics) {
      const pubsubClientId = client.clientProvidedId || clientId;
      this.logger.info(`Unsubscribing client from topic`, {
        connectionId: clientId,
        clientProvidedId: client.clientProvidedId,
        pubsubClientId,
        topic
      });
      const result = this.pubsubEngine.unsubscribe(topic, pubsubClientId);
      this.logger.info(`Unsubscribe result`, {
        connectionId: clientId,
        topic,
        result
      });
    }

    this.clients.delete(clientId);
    this.connectionCounter--;

    this.logger.info(`WebSocket client disconnected`, {
      clientId,
      code,
      reason,
      connectionCount: this.connectionCounter
    });
  }

  /**
   * Handle WebSocket error
   * @param {string} clientId - Client identifier
   * @param {Error} error - Error object
   */
  handleError(clientId, error) {
    this.logger.error(`WebSocket error for client ${clientId}`, {
      clientId,
      error: error.message,
      stack: error.stack
    });
  }

  /**
   * Send error message to client
   * @param {string} clientId - Client identifier
   * @param {string} errorCode - Error code
   * @param {string} message - Error message
   */
  sendError(clientId, errorCode, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.sendToClient(client.ws, {
      type: 'error',
      error: errorCode,
      message: message,
      ts: new Date().toISOString()
    });
  }

  /**
   * Send message to client
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Message to send
   */
  sendToClient(ws, message) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      this.logger.error('Failed to send message to client', {
        error: error.message
      });
    }
  }

  /**
   * Validate incoming message format
   * @param {Object} message - Message to validate
   * @returns {boolean} - True if valid
   */
  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (!message.type || typeof message.type !== 'string') {
      return false;
    }

    const validTypes = ['subscribe', 'unsubscribe', 'publish', 'ping'];
    if (!validTypes.includes(message.type)) {
      return false;
    }

    // Type-specific validation
    switch (message.type) {
      case 'subscribe':
      case 'unsubscribe':
      case 'publish':
        if (!message.topic || typeof message.topic !== 'string') {
          return false;
        }
        break;
    }

    return true;
  }

  /**
   * Generate unique client ID
   * @returns {string} - Unique client identifier
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get client statistics
   * @returns {Object} - Client statistics
   */
  getStats() {
    const stats = {
      totalClients: this.clients.size,
      connectionCounter: this.connectionCounter,
      clients: []
    };

    for (const [connectionId, client] of this.clients) {
      stats.clients.push({
        connectionId,
        clientProvidedId: client.clientProvidedId || 'Not set',
        topics: Array.from(client.topics),
        connectedAt: client.connectedAt,
        lastPing: client.lastPing,
        uptime: Date.now() - client.connectedAt
      });
    }

    return stats;
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    for (const [clientId, client] of this.clients) {
      this.sendToClient(client.ws, message);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger.info('Shutting down WebSocket handler...');
    
    // Close all connections
    for (const [clientId, client] of this.clients) {
      try {
        if (client.pingInterval) {
          clearInterval(client.pingInterval);
        }
        client.ws.close(1000, 'Server shutdown');
      } catch (error) {
        // Ignore errors during close
      }
    }

    this.clients.clear();
    this.connectionCounter = 0;
    
    this.logger.info('WebSocket handler shutdown complete');
  }
}

module.exports = WebSocketHandler;
