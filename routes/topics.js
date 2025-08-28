const express = require('express');
const { v4: uuidv4 } = require('uuid');

/**
 * Topic Management REST API Routes
 * 
 * Endpoints:
 * - POST /topics - Create a new topic
 * - DELETE /topics/:name - Delete a topic
 * - GET /topics - List all topics
 * - GET /topics/:name - Get topic details
 */

class TopicRoutes {
  constructor(pubsubEngine, logger) {
    this.pubsubEngine = pubsubEngine;
    this.logger = logger;
    this.router = express.Router();
    
    this.setupRoutes();
  }

  setupRoutes() {
    // Create a new topic
    this.router.post('/', this.createTopic.bind(this));
    
    // Delete a topic
    this.router.delete('/:name', this.deleteTopic.bind(this));
    
    // List all topics
    this.router.get('/', this.listTopics.bind(this));
    
    // Get topic details
    this.router.get('/:name', this.getTopic.bind(this));
  }

  /**
   * POST /topics
   * Create a new topic
   */
  async createTopic(req, res) {
    try {
      const { name } = req.body;

      // Validate input
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Topic name is required and must be a non-empty string'
        });
      }

      // Sanitize topic name
      const topicName = name.trim();

      // Check if topic already exists
      if (this.pubsubEngine.topics.has(topicName)) {
        return res.status(409).json({
          error: 'TOPIC_EXISTS',
          message: `Topic '${topicName}' already exists`
        });
      }

      // Create the topic
      const created = this.pubsubEngine.createTopic(topicName);
      
      if (created) {
        this.logger.info(`Topic created: ${topicName}`, {
          topic: topicName,
          ip: req.ip
        });

        res.status(201).json({
          status: 'created',
          topic: topicName,
          ts: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL',
          message: 'Failed to create topic'
        });
      }
    } catch (error) {
      this.logger.error('Error creating topic', {
        error: error.message,
        stack: error.stack,
        body: req.body
      });

      res.status(500).json({
        error: 'INTERNAL',
        message: 'Internal server error'
      });
    }
  }

  /**
   * DELETE /topics/:name
   * Delete a topic and disconnect all subscribers
   */
  async deleteTopic(req, res) {
    try {
      const { name } = req.params;

      // Validate input
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Topic name is required and must be a non-empty string'
        });
      }

      const topicName = name.trim();

      // Check if topic exists
      if (!this.pubsubEngine.topics.has(topicName)) {
        return res.status(404).json({
          error: 'TOPIC_NOT_FOUND',
          message: `Topic '${topicName}' not found`
        });
      }

      // Get topic info before deletion for logging
      const topicInfo = this.pubsubEngine.getTopic(topicName);

      // Delete the topic
      const deleted = this.pubsubEngine.deleteTopic(topicName);
      
      if (deleted) {
        this.logger.info(`Topic deleted: ${topicName}`, {
          topic: topicName,
          subscribers: topicInfo.subscribers,
          messages: topicInfo.messages,
          ip: req.ip
        });

        res.json({
          status: 'deleted',
          topic: topicName,
          subscribers_disconnected: topicInfo.subscribers,
          messages_lost: topicInfo.messages,
          ts: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL',
          message: 'Failed to delete topic'
        });
      }
    } catch (error) {
      this.logger.error('Error deleting topic', {
        error: error.message,
        stack: error.stack,
        params: req.params
      });

      res.status(500).json({
        error: 'INTERNAL',
        message: 'Internal server error'
      });
    }
  }

  /**
   * GET /topics
   * List all topics with subscriber counts
   */
  async listTopics(req, res) {
    try {
      const topics = this.pubsubEngine.getAllTopics();
      
      // Format response
      const response = {
        topics: topics.map(topic => ({
          name: topic.name,
          subscribers: topic.subscribers,
          messages: topic.messages,
          created_at: new Date(topic.createdAt).toISOString()
        })),
        total: topics.length,
        ts: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      this.logger.error('Error listing topics', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        error: 'INTERNAL',
        message: 'Internal server error'
      });
    }
  }

  /**
   * GET /topics/:name
   * Get detailed information about a specific topic
   */
  async getTopic(req, res) {
    try {
      const { name } = req.params;

      // Validate input
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Topic name is required and must be a non-empty string'
        });
      }

      const topicName = name.trim();

      // Get topic information
      const topic = this.pubsubEngine.getTopic(topicName);
      
      if (!topic) {
        return res.status(404).json({
          error: 'TOPIC_NOT_FOUND',
          message: `Topic '${topicName}' not found`
        });
      }

      res.json({
        topic: {
          name: topic.name,
          subscribers: topic.subscribers,
          messages: topic.messages,
          created_at: new Date(topic.createdAt).toISOString()
        },
        ts: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error getting topic', {
        error: error.message,
        stack: error.stack,
        params: req.params
      });

      res.status(500).json({
        error: 'INTERNAL',
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get the Express router
   */
  getRouter() {
    return this.router;
  }
}

module.exports = TopicRoutes;
