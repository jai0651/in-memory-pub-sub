const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

/**
 * Test Client for Pub/Sub System
 * 
 * Demonstrates:
 * - WebSocket connection
 * - Topic subscription
 * - Message publishing
 * - Message reception
 * - Error handling
 */

class TestClient {
  constructor(url = 'ws://localhost:3000/ws') {
    this.url = url;
    this.ws = null;
    this.clientId = `test_client_${Date.now()}`;
    this.subscribedTopics = new Set();
    this.messageCount = 0;
    this.isConnected = false;
  }

  /**
   * Connect to the WebSocket server
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.on('open', () => {
          this.isConnected = true;
          console.log(`✅ Connected to Pub/Sub server as ${this.clientId}`);
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('close', (code, reason) => {
          this.isConnected = false;
          console.log(`❌ Connection closed: ${code} - ${reason}`);
        });

        this.ws.on('error', (error) => {
          console.error('❌ WebSocket error:', error.message);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      this.messageCount++;
      
      console.log(`📨 Received message #${this.messageCount}:`, {
        type: message.type,
        topic: message.topic,
        timestamp: message.ts
      });

      switch (message.type) {
        case 'ack':
          console.log(`✅ Acknowledgment received for ${message.topic || 'operation'}`);
          break;
        case 'event':
          console.log(`📢 Event received on topic '${message.topic}':`, {
            messageId: message.message.id,
            payload: message.message.payload,
            replay: message.replay || false
          });
          break;
        case 'error':
          console.error(`❌ Error received:`, {
            error: message.error,
            message: message.message
          });
          break;
        case 'pong':
          console.log(`🏓 Pong received`);
          break;
        case 'info':
          if (message.message === 'heartbeat') {
            console.log(`💓 Heartbeat received`);
          } else {
            console.log(`ℹ️  Info: ${message.message}`);
          }
          break;
        default:
          console.log(`❓ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('❌ Failed to parse message:', error.message);
    }
  }

  /**
   * Subscribe to a topic
   */
  subscribe(topic, lastN = 0) {
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }

    const message = {
      type: 'subscribe',
      topic: topic,
      client_id: this.clientId,
      last_n: lastN,
      request_id: `req_${uuidv4()}`
    };

    this.ws.send(JSON.stringify(message));
    this.subscribedTopics.add(topic);
    console.log(`📝 Subscribing to topic '${topic}'${lastN > 0 ? ` with last ${lastN} messages` : ''}`);
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic) {
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }

    const message = {
      type: 'unsubscribe',
      topic: topic,
      client_id: this.clientId,
      request_id: `req_${uuidv4()}`
    };

    this.ws.send(JSON.stringify(message));
    this.subscribedTopics.delete(topic);
    console.log(`📝 Unsubscribing from topic '${topic}'`);
  }

  /**
   * Publish a message to a topic
   */
  publish(topic, payload) {
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }

    const message = {
      type: 'publish',
      topic: topic,
      message: {
        id: `msg_${uuidv4()}`,
        payload: payload
      },
      client_id: this.clientId,
      request_id: `req_${uuidv4()}`
    };

    this.ws.send(JSON.stringify(message));
    console.log(`📤 Publishing message to topic '${topic}':`, payload);
  }

  /**
   * Send ping
   */
  ping() {
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }

    const message = {
      type: 'ping',
      request_id: `req_${uuidv4()}`
    };

    this.ws.send(JSON.stringify(message));
    console.log(`🏓 Sending ping`);
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      clientId: this.clientId,
      subscribedTopics: Array.from(this.subscribedTopics),
      messageCount: this.messageCount
    };
  }

  /**
   * Close the connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.isConnected = false;
      console.log('👋 Disconnected from server');
    }
  }
}

/**
 * Demo function showing various operations
 */
async function runDemo() {
  const client = new TestClient();
  
  try {
    // Connect to server
    await client.connect();
    
    // Subscribe to a topic
    client.subscribe('orders', 3); // Get last 3 messages
    
    // Wait a bit for subscription to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Publish some messages
    client.publish('orders', {
      order_id: 'order_001',
      amount: 99.99,
      customer: 'John Doe'
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    client.publish('orders', {
      order_id: 'order_002',
      amount: 149.99,
      customer: 'Jane Smith'
    });
    
    // Subscribe to another topic
    await new Promise(resolve => setTimeout(resolve, 500));
    client.subscribe('notifications');
    
    // Publish to notifications topic
    await new Promise(resolve => setTimeout(resolve, 500));
    client.publish('notifications', {
      type: 'info',
      message: 'System maintenance scheduled',
      priority: 'low'
    });
    
    // Send a ping
    await new Promise(resolve => setTimeout(resolve, 500));
    client.ping();
    
    // Show status
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('\n📊 Client Status:', client.getStatus());
    
    // Keep connection alive for a bit to see messages
    console.log('\n⏳ Waiting for messages... (press Ctrl+C to exit)');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  } finally {
    client.disconnect();
  }
}

/**
 * Interactive client for manual testing
 */
async function runInteractive() {
  const client = new TestClient();
  
  try {
    await client.connect();
    console.log('\n🎮 Interactive mode - Available commands:');
    console.log('  subscribe <topic> [last_n]  - Subscribe to topic');
    console.log('  unsubscribe <topic>         - Unsubscribe from topic');
    console.log('  publish <topic> <json>      - Publish message');
    console.log('  ping                         - Send ping');
    console.log('  status                       - Show client status');
    console.log('  help                         - Show this help');
    console.log('  exit                         - Disconnect and exit');
    console.log('');
    
    // Keep the process running for interactive use
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (data) => {
      const input = data.trim();
      const parts = input.split(' ');
      const command = parts[0].toLowerCase();
      
      try {
        switch (command) {
          case 'subscribe':
            if (parts.length < 2) {
              console.log('❌ Usage: subscribe <topic> [last_n]');
              break;
            }
            const topic = parts[1];
            const lastN = parts[2] ? parseInt(parts[2]) : 0;
            client.subscribe(topic, lastN);
            break;
            
          case 'unsubscribe':
            if (parts.length < 2) {
              console.log('❌ Usage: unsubscribe <topic>');
              break;
            }
            client.unsubscribe(parts[1]);
            break;
            
          case 'publish':
            if (parts.length < 3) {
              console.log('❌ Usage: publish <topic> <json>');
              break;
            }
            const pubTopic = parts[1];
            const payload = JSON.parse(parts.slice(2).join(' '));
            client.publish(pubTopic, payload);
            break;
            
          case 'ping':
            client.ping();
            break;
            
          case 'status':
            console.log('📊 Status:', client.getStatus());
            break;
            
          case 'help':
            console.log('🎮 Available commands:');
            console.log('  subscribe <topic> [last_n]  - Subscribe to topic');
            console.log('  unsubscribe <topic>         - Unsubscribe from topic');
            console.log('  publish <topic> <json>      - Publish message');
            console.log('  ping                         - Send ping');
            console.log('  status                       - Show client status');
            console.log('  help                         - Show this help');
            console.log('  exit                         - Disconnect and exit');
            break;
            
          case 'exit':
            console.log('👋 Goodbye!');
            client.disconnect();
            process.exit(0);
            break;
            
          default:
            console.log(`❌ Unknown command: ${command}. Type 'help' for available commands.`);
        }
      } catch (error) {
        console.error('❌ Command failed:', error.message);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start interactive mode:', error.message);
    client.disconnect();
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--interactive') || args.includes('-i')) {
    runInteractive();
  } else {
    runDemo();
  }
}

module.exports = TestClient;
