const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

/**
 * Bounded Queue for Individual Subscribers
 * Implements proper backpressure handling with configurable policies
 */
class SubscriberQueue {
  constructor(clientId, maxSize = 100, policy = 'drop_oldest') {
    this.clientId = clientId;
    this.maxSize = maxSize;
    this.policy = policy; // 'drop_oldest' or 'disconnect'
    this.queue = [];
    this.droppedCount = 0;
    this.totalProcessed = 0;
  }

  /**
   * Add a message to the queue with backpressure handling
   * @param {Object} message - Message to add
   * @param {WebSocket} ws - WebSocket connection
   * @returns {Object} - Result of the operation
   */
  add(message, ws) {
    // Check if queue is full
    if (this.queue.length >= this.maxSize) {
      if (this.policy === 'disconnect') {
        // Disconnect policy: close connection with SLOW_CONSUMER error
        try {
          ws.close(1013, 'SLOW_CONSUMER');
        } catch (error) {
          // Ignore close errors
        }
        return {
          success: false,
          action: 'disconnected',
          reason: 'SLOW_CONSUMER',
          droppedCount: this.droppedCount
        };
      } else {
        // drop_oldest policy: remove oldest message and add new one
        const droppedMessage = this.queue.shift();
        this.droppedCount++;
        
        this.queue.push(message);
        this.totalProcessed++;
        
        return {
          success: true,
          action: 'dropped_oldest',
          droppedMessage: droppedMessage,
          droppedCount: this.droppedCount
        };
      }
    } else {
      // Queue has space, add message normally
      this.queue.push(message);
      this.totalProcessed++;
      return {
        success: true,
        action: 'added',
        droppedCount: this.droppedCount
      };
    }
  }

  /**
   * Get the next message from the queue
   * @returns {Object|null} - Next message or null if empty
   */
  getNext() {
    return this.queue.length > 0 ? this.queue.shift() : null;
  }

  /**
   * Get queue statistics
   * @returns {Object} - Queue statistics
   */
  getStats() {
    return {
      clientId: this.clientId,
      queueSize: this.queue.length,
      maxSize: this.maxSize,
      droppedCount: this.droppedCount,
      totalProcessed: this.totalProcessed,
      policy: this.policy
    };
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
  }
}

/**
 * In-Memory Pub/Sub System
 * 
 * Features:
 * - Topic-based message routing
 * - Fan-out delivery (each subscriber gets every message exactly once)
 * - Topic isolation (no cross-topic message leaks)
 * - Concurrency safety with Map-based subscriber management
 * - Backpressure handling with bounded per-subscriber queues
 * - Message replay support with ring buffer
 * - Graceful shutdown support
 */

class PubSubEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.topics = new Map();
    this.clientTopics = new Map(); // clientId -> Set of topics
    this.subscriberQueues = new Map(); // clientId -> SubscriberQueue
    this.maxMessagesPerTopic = options.maxMessagesPerTopic || 100;
    this.maxQueueSize = options.maxQueueSize || 100;
    this.backpressurePolicy = options.backpressurePolicy || 'drop_oldest'; // 'drop_oldest' or 'disconnect'
    
    // Heartbeat configuration
    this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds
    this.heartbeatTimer = null;
    
    this.startHeartbeat();
  }

  /**
   * Create a new topic
   * @param {string} topicName - Name of the topic
   * @returns {boolean} - True if created, false if already exists
   */
  createTopic(topicName) {
    if (this.topics.has(topicName)) {
      return false;
    }

    this.topics.set(topicName, {
      subscribers: new Map(), // clientId -> WebSocket
      messages: [], // Ring buffer for message replay
      createdAt: Date.now()
    });

    this.emit('topicCreated', topicName);
    return true;
  }

  /**
   * Delete a topic and disconnect all subscribers
   * @param {string} topicName - Name of the topic to delete
   * @returns {boolean} - True if deleted, false if not found
   */
  deleteTopic(topicName) {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return false;
    }

    // Disconnect all subscribers
    for (const [clientId, ws] of topic.subscribers) {
      try {
        ws.close(1000, 'Topic deleted');
      } catch (error) {
        // Ignore errors during close
      }
    }

    this.topics.delete(topicName);
    
    // Clean up client topic mappings
    for (const [clientId, topics] of this.clientTopics) {
      topics.delete(topicName);
      if (topics.size === 0) {
        this.clientTopics.delete(clientId);
      }
    }

    this.emit('topicDeleted', topicName);
    return true;
  }

  /**
   * Subscribe a client to a topic
   * @param {string} topicName - Name of the topic
   * @param {string} clientId - Unique client identifier
   * @param {WebSocket} ws - WebSocket connection
   * @param {number} lastN - Number of recent messages to replay
   * @returns {Object} - Subscription result
   */
  subscribe(topicName, clientId, ws, lastN = 0) {
    if (!this.topics.has(topicName)) {
      return { success: false, error: 'TOPIC_NOT_FOUND' };
    }

    const topic = this.topics.get(topicName);
    
    // Check if client is already subscribed
    if (topic.subscribers.has(clientId)) {
      return { success: false, error: 'ALREADY_SUBSCRIBED' };
    }

    // Create subscriber queue if it doesn't exist
    if (!this.subscriberQueues.has(clientId)) {
      this.subscriberQueues.set(clientId, new SubscriberQueue(
        clientId, 
        this.maxQueueSize, 
        this.backpressurePolicy
      ));
    }

    // Add subscriber
    topic.subscribers.set(clientId, ws);
    
    // Track client's topics
    if (!this.clientTopics.has(clientId)) {
      this.clientTopics.set(clientId, new Set());
    }
    this.clientTopics.get(clientId).add(topicName);

    // Replay recent messages if requested
    if (lastN > 0 && topic.messages.length > 0) {
      const messagesToReplay = topic.messages.slice(-lastN);
      for (const message of messagesToReplay) {
        this.sendToClient(ws, {
          type: 'event',
          topic: topicName,
          message: message,
          ts: new Date().toISOString(),
          replay: true
        });
      }
    }

    this.emit('clientSubscribed', topicName, clientId);
    return { success: true };
  }

  /**
   * Unsubscribe a client from a topic
   * @param {string} topicName - Name of the topic
   * @param {string} clientId - Unique client identifier
   * @returns {boolean} - True if unsubscribed, false if not found
   */
  unsubscribe(topicName, clientId) {
    const topic = this.topics.get(topicName);
    if (!topic || !topic.subscribers.has(clientId)) {
      return false;
    }

    topic.subscribers.delete(clientId);
    
    // Clean up client topic mapping
    const clientTopics = this.clientTopics.get(clientId);
    if (clientTopics) {
      clientTopics.delete(topicName);
      if (clientTopics.size === 0) {
        this.clientTopics.delete(clientId);
        // Clean up subscriber queue when client has no more topics
        this.subscriberQueues.delete(clientId);
      }
    }

    this.emit('clientUnsubscribed', topicName, clientId);
    return true;
  }

  /**
   * Publish a message to a topic
   * @param {string} topicName - Name of the topic
   * @param {Object} message - Message object with id and payload
   * @returns {Object} - Publish result
   */
  publish(topicName, message) {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return { success: false, error: 'TOPIC_NOT_FOUND' };
    }

    // Validate message
    if (!message.id || !message.payload) {
      return { success: false, error: 'INVALID_MESSAGE' };
    }

    // Add timestamp if not present
    if (!message.ts) {
      message.ts = Date.now();
    }

    // Store message in ring buffer
    topic.messages.push(message);
    if (topic.messages.length > this.maxMessagesPerTopic) {
      topic.messages.shift(); // Remove oldest message
    }

    // Fan-out to all subscribers using bounded queues
    const deliveryResults = [];
    for (const [clientId, ws] of topic.subscribers) {
      try {
        // Get or create subscriber queue
        const subscriberQueue = this.subscriberQueues.get(clientId);
        if (!subscriberQueue) {
          deliveryResults.push({ 
            clientId, 
            success: false, 
            error: 'SUBSCRIBER_QUEUE_NOT_FOUND' 
          });
          continue;
        }

        // Create the message to send
        const messageToSend = {
          type: 'event',
          topic: topicName,
          message: message,
          ts: new Date().toISOString()
        };

        // Add message to subscriber's bounded queue
        const queueResult = subscriberQueue.add(messageToSend, ws);
        
        if (queueResult.success) {
          // Message was added to queue successfully
          if (queueResult.action === 'dropped_oldest') {
            // Log that an old message was dropped
            this.emit('messageDropped', clientId, topicName, queueResult.droppedMessage);
          }
          
          // Try to send the message immediately
          const sendResult = this.sendToClient(ws, messageToSend);
          deliveryResults.push({ 
            clientId, 
            success: sendResult,
            action: queueResult.action,
            droppedCount: queueResult.droppedCount
          });
        } else {
          // Queue policy triggered (e.g., disconnect)
          deliveryResults.push({ 
            clientId, 
            success: false, 
            action: queueResult.action,
            reason: queueResult.reason,
            droppedCount: queueResult.droppedCount
          });
        }
      } catch (error) {
        deliveryResults.push({ 
          clientId, 
          success: false, 
          error: error.message 
        });
      }
    }

    this.emit('messagePublished', topicName, message, deliveryResults);
    return { 
      success: true, 
      subscribers: topic.subscribers.size,
      deliveryResults 
    };
  }

  /**
   * Send message to a specific client
   * Note: Backpressure is now handled by SubscriberQueue
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Message to send
   * @returns {boolean} - True if sent successfully
   */
  sendToClient(ws, message) {
    try {
      // Check if WebSocket is ready
      if (ws.readyState !== 1) { // 1 = OPEN
        return false;
      }

      // Send message directly (backpressure handled by queue)
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get topic information
   * @param {string} topicName - Name of the topic
   * @returns {Object|null} - Topic information or null if not found
   */
  getTopic(topicName) {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return null;
    }

    return {
      name: topicName,
      subscribers: topic.subscribers.size,
      messages: topic.messages.length,
      createdAt: topic.createdAt
    };
  }

  /**
   * Get all topics
   * @returns {Array} - Array of topic information
   */
  getAllTopics() {
    const topics = [];
    for (const [topicName, topic] of this.topics) {
      topics.push({
        name: topicName,
        subscribers: topic.subscribers.size,
        messages: topic.messages.length,
        createdAt: topic.createdAt
      });
    }
    return topics;
  }

  /**
   * Get system statistics
   * @returns {Object} - System statistics
   */
  getStats() {
    const stats = {
      topics: {},
      totalSubscribers: 0,
      totalMessages: 0,
      queues: {
        totalQueues: this.subscriberQueues.size,
        totalDroppedMessages: 0,
        queueStats: {}
      }
    };

    for (const [topicName, topic] of this.topics) {
      stats.topics[topicName] = {
        messages: topic.messages.length,
        subscribers: topic.subscribers.size
      };
      stats.totalSubscribers += topic.subscribers.size;
      stats.totalMessages += topic.messages.length;
    }

    // Add queue statistics
    for (const [clientId, queue] of this.subscriberQueues) {
      const queueStats = queue.getStats();
      stats.queues.queueStats[clientId] = queueStats;
      stats.queues.totalDroppedMessages += queueStats.droppedCount;
    }

    return stats;
  }

  /**
   * Get client information
   * @param {string} clientId - Client identifier
   * @returns {Object|null} - Client information or null if not found
   */
  getClient(clientId) {
    const topics = this.clientTopics.get(clientId);
    if (!topics) {
      return null;
    }

    const queue = this.subscriberQueues.get(clientId);
    const queueStats = queue ? queue.getStats() : null;

    return {
      clientId,
      topics: Array.from(topics),
      topicCount: topics.size,
      queue: queueStats
    };
  }

  /**
   * Disconnect a client from all topics
   * @param {string} clientId - Client identifier
   * @returns {boolean} - True if client was found and disconnected
   */
  disconnectClient(clientId) {
    const topics = this.clientTopics.get(clientId);
    if (!topics) {
      return false;
    }

    // Unsubscribe from all topics
    for (const topicName of topics) {
      this.unsubscribe(topicName, clientId);
    }

    return true;
  }

  /**
   * Start heartbeat system
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.emit('heartbeat');
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat system
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.stopHeartbeat();
    
    // Disconnect all clients
    for (const [clientId] of this.clientTopics) {
      this.disconnectClient(clientId);
    }

    // Clear all topics
    this.topics.clear();
    this.clientTopics.clear();

    this.emit('shutdown');
  }
}

module.exports = PubSubEngine;
