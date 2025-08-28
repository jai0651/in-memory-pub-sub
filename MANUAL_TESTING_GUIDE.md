# 🧪 Manual Testing Guide for Plivo Pub/Sub System

## 🎉 **IMPORTANT UPDATE: WebSocket Client ID Issue FIXED!**

**✅ The "Client ID mismatch" error has been completely resolved!**  
**✅ You can now use any client_id you want in WebSocket messages!**  
**✅ All WebSocket operations work perfectly!**

This guide provides step-by-step instructions to manually test all functionalities of the Pub/Sub system. Follow each section to verify that everything works correctly.

### 🚀 **Quick Start - Test the Fix**

```bash
# 1. Start server
node server.js &

# 2. Wait for startup
sleep 3

# 3. Test WebSocket (should work without errors)
node test-websocket.js

# Expected: "🎉 WebSocket test passed!"
```

## 📋 Prerequisites

Before starting, ensure you have:
- Node.js 18+ installed
- The Pub/Sub server running
- A terminal/command line tool
- A WebSocket client (we'll use the built-in test client)

## 🚀 Step 1: Start the Server

### ✅ **Quick Test: Verify Client ID Fix**

Before starting the full testing, let's quickly verify that the WebSocket client ID issue is fixed:

```bash
# Start the server
node server.js &

# Wait for server to start
sleep 3

# Test WebSocket connection with custom client_id
node test-websocket.js

# Expected: Should connect and subscribe successfully without any "Client ID mismatch" errors
```

**If you see "🎉 WebSocket test passed!" - the fix is working!**

### Option A: Using npm
```bash
npm install
npm start
```

### Option B: Using the startup script
```bash
chmod +x start.sh
./start.sh
```

### Option C: Using Docker
```bash
docker build -t plivo-pubsub .
docker run -p 3000:3000 plivo-pubsub
```

**Expected Output:**
```
🚀 Plivo Pub/Sub System Startup
==================================

✅ Node.js v22.17.0 detected
✅ npm 10.2.4 detected
📁 Dependencies already installed
📁 Logs directory created
📋 Environment configured:
  NODE_ENV: production
  PORT: 3000
  HOST: 0.0.0.0
  LOG_LEVEL: info
  MAX_MESSAGES_PER_TOPIC: 100
  MAX_QUEUE_SIZE: 1000
  BACKPRESSURE_POLICY: drop_oldest
  HEARTBEAT_INTERVAL: 30000ms

✅ All checks passed. Starting server...

📋 Starting Pub/Sub server...
📋 Server will be available at:
  HTTP: http://0.0.0.0:3000
  WebSocket: ws://0.0.0.0:3000/ws
  Health: http://0.0.0.0:3000/health
  Topics: http://0.0.0.0:3000/topics
  Stats: http://0.0.0.0:3000/stats
```

## 🔍 Step 2: Test Health Endpoint

Test the basic health check to ensure the server is running:

```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "Pub/Sub Server",
  "timestamp": "2025-08-28T04:39:26.619Z"
}
```

## 📊 Step 3: Test System Information Endpoints

### Test System Stats
```bash
curl http://localhost:3000/stats
```

**Expected Response:**
```json
{
  "system": {
    "uptime_sec": 15,
    "start_time": "2025-08-28T04:40:51.790Z",
    "memory": {
      "rss": 54.09,
      "heapTotal": 10.59,
      "heapUsed": 8.82,
      "external": 2.12,
      "arrayBuffers": 0.02
    },
    "node_version": "v22.17.0",
    "platform": "darwin"
  },
  "topics": {},
  "total_subscribers": 0,
  "total_messages": 0,
  "websocket": {
    "total_clients": 0,
    "connection_counter": 0,
    "active_connections": 0
  },
  "ts": "2025-08-28T04:41:01.033Z"
}
```

### Test System Info
```bash
curl http://localhost:3000/info
```

**Expected Response:**
```json
{
  "service": "Plivo Pub/Sub System",
  "version": "1.0.0",
  "description": "In-memory Pub/Sub system with Express.js and WebSockets",
  "features": [
    "Topic-based message routing",
    "Fan-out delivery",
    "Topic isolation",
    "Message replay support",
    "Backpressure handling",
    "WebSocket protocol",
    "REST API management"
  ],
  "configuration": {
    "max_messages_per_topic": 100,
    "max_queue_size": 1000,
    "backpressure_policy": "drop_oldest",
    "heartbeat_interval_ms": 30000
  },
  "status": {
    "uptime_sec": 20,
    "start_time": "2025-08-28T04:40:51.790Z",
    "topics_count": 0,
    "total_subscribers": 0,
    "total_messages": 0,
    "active_connections": 0
  },
  "endpoints": {
    "rest": {
      "topics": "/topics",
      "health": "/health",
      "stats": "/stats",
      "info": "/info"
    },
    "websocket": "/ws"
  },
  "protocol": {
    "websocket": {
      "message_types": ["subscribe", "unsubscribe", "publish", "ping"],
      "response_types": ["ack", "event", "error", "pong", "info"]
    }
  },
  "ts": "2025-08-28T04:41:07.941Z"
}
```

## 📝 Step 4: Test Topic Management REST APIs

### Test List Topics (should be empty initially)
```bash
curl http://localhost:3000/topics
```

**Expected Response:**
```json
{
  "topics": [],
  "total": 0,
  "ts": "2025-08-28T04:41:23.040Z"
}
```

### Test Create Topic
```bash
curl -X POST http://localhost:3000/topics \
  -H "Content-Type: application/json" \
  -d '{"name": "orders"}'
```

**Expected Response:**
```json
{
  "status": "created",
  "topic": "orders",
  "ts": "2025-08-28T04:41:15.869Z"
}
```

### Test Create Another Topic
```bash
curl -X POST http://localhost:3000/topics \
  -H "Content-Type: application/json" \
  -d '{"name": "notifications"}'
```

**Expected Response:**
```json
{
  "status": "created",
  "topic": "notifications",
  "ts": "2025-08-28T04:41:16.000Z"
}
```

### Test Create Duplicate Topic (should fail)
```bash
curl -X POST http://localhost:3000/topics \
  -H "Content-Type: application/json" \
  -d '{"name": "orders"}'
```

**Expected Response:**
```json
{
  "error": "TOPIC_EXISTS",
  "message": "Topic 'orders' already exists"
}
```

### Test List Topics (should show 2 topics)
```bash
curl http://localhost:3000/topics
```

**Expected Response:**
```json
{
  "topics": [
    {
      "name": "orders",
      "subscribers": 0,
      "messages": 0,
      "created_at": "2025-08-28T04:41:15.869Z"
    },
    {
      "name": "notifications",
      "subscribers": 0,
      "messages": 0,
      "created_at": "2025-08-28T04:41:16.000Z"
    }
  ],
  "total": 2,
  "ts": "2025-08-28T04:41:25.000Z"
}
```

### Test Get Specific Topic
```bash
curl http://localhost:3000/topics/orders
```

**Expected Response:**
```json
{
  "topic": {
    "name": "orders",
    "subscribers": 0,
    "messages": 0,
    "created_at": "2025-08-28T04:41:15.869Z"
  },
  "ts": "2025-08-28T04:41:26.000Z"
}
```

### Test Get Non-existent Topic
```bash
curl http://localhost:3000/topics/nonexistent
```

**Expected Response:**
```json
{
  "error": "TOPIC_NOT_FOUND",
  "message": "Topic 'nonexistent' not found"
}
```

## 🔌 Step 5: Test WebSocket Functionality

### ✅ **IMPORTANT: Client ID Issue FIXED!**

The WebSocket client ID functionality has been completely fixed. You can now use **any client_id you want** - the server will accept and use it for Pub/Sub operations.

### Option A: Using Postman (Recommended)

Postman has excellent WebSocket support. Follow these steps:

1. **Open Postman** and click on "New" → "WebSocket Request"
2. **Enter WebSocket URL**: `ws://localhost:3000/ws`
3. **Click "Connect"** to establish the connection
4. **Send messages** using the message input field

#### Test Subscribe to Topic
```json
{
  "type": "subscribe",
  "topic": "orders",
  "client_id": "client_123",
  "last_n": 3,
  "request_id": "req-001"
}
```

#### Test Publish Message
```json
{
  "type": "publish",
  "topic": "orders",
  "message": {
    "id": "msg-001",
    "payload": {
      "order_id": "ORD-123",
      "amount": 99.99,
      "currency": "USD"
    }
  },
  "client_id": "client_123",
  "request_id": "req-002"
}
```

#### Test Ping
```json
{
  "type": "ping",
  "request_id": "req-003"
}
```

#### Test Unsubscribe
```json
{
  "type": "unsubscribe",
  "topic": "orders",
  "client_id": "client_123",
  "request_id": "req-004"
}
```

### Option B: Using wscat (Command Line Tool)

Install wscat globally:
```bash
npm install -g wscat
```

Connect to WebSocket:
```bash
wscat -c ws://localhost:3000/ws
```

Send messages (one per line):
```json
{"type": "subscribe", "topic": "orders", "client_id": "client_123", "last_n": 3, "request_id": "req-001"}
{"type": "publish", "topic": "orders", "message": {"id": "msg-001", "payload": {"order_id": "ORD-123", "amount": 99.99}}, "client_id": "client_123", "request_id": "req-002"}
{"type": "ping", "request_id": "req-003"}
```

### Option C: Using Browser Developer Tools

1. **Open browser** and go to any page
2. **Open Developer Tools** (F12)
3. **Go to Console** tab
4. **Create WebSocket connection**:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected to WebSocket');
  
  // Subscribe to topic
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic: 'orders',
    client_id: 'browser_client',
    last_n: 3,
    request_id: 'req-001'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

ws.onclose = () => console.log('Disconnected');
ws.onerror = (error) => console.error('Error:', error);
```

### Option D: Using curl (for HTTP endpoints only)

Note: curl cannot test WebSocket connections, but you can test the REST API endpoints:

```bash
# Test health
curl http://localhost:3000/health

# Test topics
curl http://localhost:3000/topics

# Create topic
curl -X POST http://localhost:3000/topics \
  -H "Content-Type: application/json" \
  -d '{"name": "orders"}'
```

### Test Subscribe to Topic
Using Postman or wscat, send this message:

```json
{
  "type": "subscribe",
  "topic": "orders",
  "client_id": "client_123",
  "last_n": 3,
  "request_id": "req-001"
}
```

**✅ Expected Response (Client ID Issue Fixed!):**
```json
{
  "type": "ack",
  "request_id": "req-001",
  "topic": "orders",
  "status": "ok",
  "ts": "2025-08-28T04:41:30.000Z"
}
```

**🎯 Key Points:**
- **Any client_id works**: Use `client_123`, `my_client`, `test_user`, etc.
- **No more validation errors**: Server accepts any client-provided ID
- **Proper tracking**: Server tracks both connection ID and client-provided ID

**Expected Response:**
```json
{
  "type": "ack",
  "request_id": "req-001",
  "topic": "orders",
  "status": "ok",
  "ts": "2025-08-28T04:41:30.000Z"
}
```

### Test Subscribe to Another Topic
Send this message:

```json
{
  "type": "subscribe",
  "topic": "notifications",
  "client_id": "client_123",
  "last_n": 0,
  "request_id": "req-002"
}
```

**Expected Response:**
```json
{
  "type": "ack",
  "request_id": "req-002",
  "topic": "notifications",
  "status": "ok",
  "ts": "2025-08-28T04:41:31.000Z"
}
```

### Test Publish Message
Send this message:

```json
{
  "type": "publish",
  "topic": "orders",
  "message": {
    "id": "msg-001",
    "payload": {
      "order_id": "ORD-123",
      "amount": 99.99,
      "currency": "USD"
    }
  },
  "client_id": "client_123",
  "request_id": "req-003"
}
```

**Expected Response:**
```json
{
  "type": "ack",
  "request_id": "req-003",
  "topic": "orders",
  "status": "ok",
  subscribers: 1,
  "ts": "2025-08-28T04:41:32.000Z"
}
```

### Test Publish Another Message
Send this message:

```json
{
  "type": "publish",
  "topic": "notifications",
  "message": {
    "id": "msg-002",
    "payload": {
      "type": "info",
      "message": "System maintenance scheduled",
      "priority": "low"
    }
  },
  "client_id": "client_123",
  "request_id": "req-004"
}
```

**Expected Response:**
```json
{
  "type": "ack",
  "request_id": "req-004",
  "topic": "notifications",
  "status": "ok",
  "subscribers": 1,
  "ts": "2025-08-28T04:41:33.000Z"
}
```

### Test Ping
Send this message:

```json
{
  "type": "ping",
  "request_id": "req-005"
}
```

**Expected Response:**
```json
{
  "type": "pong",
  "request_id": "req-005",
  "ts": "2025-08-28T04:41:34.000Z"
}
```

### Test Status
```
status
```

**Expected Output:**
```
📊 Status: {
  connected: true,
  clientId: 'test_client_1756356096756',
  subscribedTopics: ['orders', 'notifications'],
  messageCount: 5
}
```

### Test Heartbeat (wait for automatic heartbeat)
Wait about 30 seconds and you should see:
```
📨 Received message #6: {
  type: 'info',
  message: 'heartbeat',
  ts: '2025-08-28T04:42:00.000Z'
}
💓 Heartbeat received
```

## 🔄 Step 6: Test Message Replay

### Test Message Replay
To test message replay, you need to:

1. **First, publish some messages** to a topic
2. **Then subscribe with last_n parameter** to receive replay

#### Step 1: Publish Messages
Send these messages in sequence:

```json
{
  "type": "publish",
  "topic": "orders",
  "message": {
    "id": "msg-001",
    "payload": {"order_id": "ORD-123", "amount": 99.99, "currency": "USD"}
  },
  "client_id": "client_123",
  "request_id": "req-006"
}
```

```json
{
  "type": "publish",
  "topic": "orders",
  "message": {
    "id": "msg-002",
    "payload": {"order_id": "ORD-456", "amount": 149.99, "currency": "USD"}
  },
  "client_id": "client_123",
  "request_id": "req-007"
}
```

#### Step 2: Subscribe with Replay
Now subscribe with last_n=2 to get the last 2 messages:

```json
{
  "type": "subscribe",
  "topic": "orders",
  "client_id": "client_456",
  "last_n": 2,
  "request_id": "req-008"
}
```

**Expected Response Sequence:**
1. **Acknowledgment:**
```json
{
  "type": "ack",
  "request_id": "req-008",
  "topic": "orders",
  "status": "ok",
  "ts": "2025-08-28T04:42:10.000Z"
}
```

2. **Replay Message 1:**
```json
{
  "type": "event",
  "topic": "orders",
  "message": {
    "id": "msg-001",
    "payload": {"order_id": "ORD-123", "amount": 99.99, "currency": "USD"}
  },
  "ts": "2025-08-28T04:42:11.000Z",
  "replay": true
}
```

3. **Replay Message 2:**
```json
{
  "type": "event",
  "topic": "orders",
  "message": {
    "id": "msg-002",
    "payload": {"order_id": "ORD-456", "amount": 149.99, "currency": "USD"}
  },
  "ts": "2025-08-28T04:42:12.000Z",
  "replay": true
}
```

## 🧪 Step 7: Test Multiple Clients and Fan-out

### Test with Multiple WebSocket Connections

To test fan-out delivery, you need multiple WebSocket connections. You can use:

1. **Multiple Postman tabs** with WebSocket connections
2. **Multiple wscat terminals**
3. **Browser + Postman combination**

### Option A: Using Multiple Postman Tabs

1. **Open Postman** and create **2 WebSocket connections** to `ws://localhost:3000/ws`
2. **Label them** as "Client 1" and "Client 2"

### Subscribe Both Clients to Same Topic

**Client 1 - Subscribe:**
```json
{
  "type": "subscribe",
  "topic": "orders",
  "client_id": "client_001",
  "last_n": 0,
  "request_id": "req-009"
}
```

**Client 2 - Subscribe:**
```json
{
  "type": "subscribe",
  "topic": "orders",
  "client_id": "client_002",
  "last_n": 0,
  "request_id": "req-010"
}
```

**Expected Response for Both:**
```json
{
  "type": "ack",
  "request_id": "req-009",
  "topic": "orders",
  "status": "ok",
  "ts": "2025-08-28T04:42:20.000Z"
}
```

### Publish Message and Verify Fan-out

**Client 1 - Publish:**
```json
{
  "type": "publish",
  "topic": "orders",
  "message": {
    "id": "msg-003",
    "payload": {
      "order_id": "ORD-456",
      "amount": 149.99,
      "currency": "USD"
    }
  },
  "client_id": "client_001",
  "request_id": "req-011"
}
```

**Expected Response Sequence:**

1. **Client 1 (Publisher) receives acknowledgment:**
```json
{
  "type": "ack",
  "request_id": "req-011",
  "topic": "orders",
  "status": "ok",
  "subscribers": 2,
  "ts": "2025-08-28T04:42:21.000Z"
}
```

2. **Both clients receive the event message:**
```json
{
  "type": "event",
  "topic": "orders",
  "message": {
    "id": "msg-003",
    "payload": {
      "order_id": "ORD-456",
      "amount": 149.99,
      "currency": "USD"
    }
  },
  "ts": "2025-08-28T04:42:22.000Z"
}
```

### Option B: Using wscat in Multiple Terminals

**Terminal 1:**
```bash
wscat -c ws://localhost:3000/ws
# Send subscribe message
```

**Terminal 2:**
```bash
wscat -c ws://localhost:3000/ws
# Send subscribe message
```

**Terminal 3:**
```bash
wscat -c ws://localhost:3000/ws
# Send publish message
```

## 🗑️ Step 8: Test Topic Deletion

### Verify Current Topics
```bash
curl http://localhost:3000/topics
```

### Delete a Topic
```bash
curl -X DELETE http://localhost:3000/topics/notifications
```

**Expected Response:**
```json
{
  "status": "deleted",
  "topic": "notifications",
  "subscribers_disconnected": 1,
  "messages_lost": 1,
  "ts": "2025-08-28T04:42:30.000Z"
}
```

### Verify Topic Deletion
```bash
curl http://localhost:3000/topics
```

**Expected Response:**
```json
{
  "topics": [
    {
      "name": "orders",
      "subscribers": 2,
      "messages": 2,
      "created_at": "2025-08-28T04:41:15.869Z"
    }
  ],
  "total": 1,
  "ts": "2025-08-28T04:42:31.000Z"
}
```

### Check Client Disconnection
In the second client, you should see:
```
❌ Connection closed: 1000 - Topic deleted
```

## 📊 Step 9: Test Statistics and Monitoring

### Check Updated Stats
```bash
curl http://localhost:3000/stats
```

**Expected Response:**
```json
{
  "system": {
    "uptime_sec": 120,
    "start_time": "2025-08-28T04:40:51.790Z",
    "memory": {...},
    "node_version": "v22.17.0",
    "platform": "darwin"
  },
  "topics": {
    "orders": {
      "messages": 2,
      "subscribers": 2
    }
  },
  "total_subscribers": 2,
  "total_messages": 2,
  "websocket": {
    "total_clients": 2,
    "connection_counter": 2,
    "active_connections": 2
  },
  "ts": "2025-08-28T04:42:35.000Z"
}
```

### Check Health Status
```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "uptime_sec": 125,
  "topics": 1,
  "subscribers": 2,
  "connections": 2,
  "ts": "2025-08-28T04:42:36.000Z"
}
```

## 🚨 Step 10: Test Error Handling

### Test Invalid JSON
```bash
curl -X POST http://localhost:3000/topics \
  -H "Content-Type: application/json" \
  -d '{"name":}'
```

**Expected Response:**
```json
{
  "error": "BAD_REQUEST",
  "message": "Invalid JSON"
}
```

### Test Missing Topic Name
```bash
curl -X POST http://localhost:3000/topics \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "error": "BAD_REQUEST",
  "message": "Topic name is required and must be a non-empty string"
}
```

### Test Empty Topic Name
```bash
curl -X POST http://localhost:3000/topics \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'
```

**Expected Response:**
```json
{
  "error": "BAD_REQUEST",
  "message": "Topic name is required and must be a non-empty string"
}
```

### Test Invalid WebSocket Message
Send an invalid message to test error handling:

```json
{
  "type": "publish",
  "topic": "orders"
}
```

**Expected Response:**
```json
{
  "type": "error",
  "error": "BAD_REQUEST",
  "message": "Message must have id and payload",
  "ts": "2025-08-28T04:42:40.000Z"
}
```

### Test Missing client_id
Send a message without client_id:

```json
{
  "type": "subscribe",
  "topic": "orders",
  "last_n": 0,
  "request_id": "req-012"
}
```

**Expected Response:**
```json
{
  "type": "error",
  "error": "BAD_REQUEST",
  "message": "client_id is required for this operation",
  "ts": "2025-08-28T04:42:41.000Z"
}
```

### Test Invalid Topic
Send a message to a non-existent topic:

```json
{
  "type": "publish",
  "topic": "nonexistent",
  "message": {
    "id": "msg-004",
    "payload": {"test": "data"}
  },
  "client_id": "client_123",
  "request_id": "req-013"
}
```

**Expected Response:**
```json
{
  "type": "error",
  "error": "TOPIC_NOT_FOUND",
  "message": "Topic 'nonexistent' not found",
  "ts": "2025-08-28T04:42:42.000Z"
}
```

## 🔄 Step 11: Test Graceful Shutdown

### Start Server in Background
```bash
node server.js &
SERVER_PID=$!
```

### Test Normal Operation
```bash
curl http://localhost:3000/health
```

### Send Shutdown Signal
```bash
kill -TERM $SERVER_PID
```

**Expected Output:**
```
2025-08-28T04:43:00.000Z [info]: Received SIGTERM, starting graceful shutdown...
2025-08-28T04:43:00.001Z [info]: Shutting down WebSocket handler...
2025-08-28T04:43:00.002Z [info]: WebSocket handler shutdown complete
2025-08-28T04:43:00.003Z [info]: HTTP server closed
2025-08-28T04:43:00.004Z [info]: Pub/Sub engine shutdown complete
2025-08-28T04:43:00.005Z [info]: Graceful shutdown complete
```

## 🐳 Step 12: Test Docker Deployment

### Build Docker Image
```bash
docker build -t plivo-pubsub .
```

### Run Container
```bash
docker run -d --name plivo-test -p 3001:3000 plivo-pubsub
```

### Test Containerized Service
```bash
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "Pub/Sub Server",
  "timestamp": "2025-08-28T04:43:30.000Z"
}
```

### Stop Container
```bash
docker stop plivo-test
docker rm plivo-test
```

## 🧪 Step 13: Test Backpressure Handling

### Start Server with Low Queue Size
```bash
MAX_QUEUE_SIZE=100 node server.js &
SERVER_PID=$!
```

### Start Multiple Test Clients
```bash
# Client 1
node examples/test-client.js &
# Client 2  
node examples/test-client.js &
# Client 3
node examples/test-client.js &
```

### Subscribe All Clients to Same Topic
In each client, subscribe to a topic:
```
subscribe stress-test
```

### Publish Many Messages Rapidly
In one client, publish messages rapidly:
```
publish stress-test {"id": 1, "data": "message1"}
publish stress-test {"id": 2, "data": "message2"}
publish stress-test {"id": 3, "data": "message3"}
# ... continue rapidly
```

### Observe Backpressure Behavior
- With `drop_oldest` policy: Some messages will be dropped
- With `disconnect` policy: Slow clients will be disconnected with SLOW_CONSUMER error

### Clean Up
```bash
kill $SERVER_PID
pkill -f "test-client.js"
```

## 📋 Step 14: Final Verification

### Check All Endpoints Work
```bash
# Health
curl http://localhost:3000/health

# Stats
curl http://localhost:3000/stats

# Topics
curl http://localhost:3000/topics

# Info
curl http://localhost:3000/info
```

### Verify WebSocket Functionality
Using Postman, wscat, or browser console, verify:
- Connection establishment
- Topic subscription
- Message publishing
- Message reception
- Heartbeat functionality
- Error handling
- Fan-out delivery to multiple clients
- Message replay functionality

## ✅ Test Completion Checklist

- [ ] Server starts successfully
- [ ] Health endpoint responds correctly
- [ ] Stats endpoint provides system information
- [ ] Info endpoint shows system details
- [ ] Topic creation works
- [ ] Topic listing works
- [ ] Topic deletion works
- [ ] WebSocket connection established
- [ ] ✅ **Client ID functionality works (FIXED!)** - Any client_id accepted
- [ ] Topic subscription works
- [ ] Message publishing works
- [ ] Message reception works
- [ ] Fan-out delivery works (multiple clients)
- [ ] Message replay works
- [ ] Ping/pong works
- [ ] Heartbeat works
- [ ] Error handling works
- [ ] Graceful shutdown works
- [ ] Docker deployment works
- [ ] Backpressure handling works

## 🎯 Expected Results

After completing all tests, you should have verified:

1. **REST API Functionality**: All endpoints work correctly
2. **WebSocket Protocol**: Full protocol implementation works
3. **Pub/Sub Operations**: Create, subscribe, publish, unsubscribe all work
4. **Message Delivery**: Fan-out delivery to all subscribers
5. **Topic Management**: Create, delete, list topics
6. **Error Handling**: Proper error codes and messages
7. **Monitoring**: Health, stats, and info endpoints
8. **Graceful Shutdown**: Clean server shutdown
9. **Docker Support**: Containerized deployment
10. **Backpressure**: Queue overflow handling

## 🔧 Technical Implementation Details

### ✅ **How the Client ID Fix Works**

The WebSocket client ID issue has been completely resolved through the following technical changes:

1. **Dual ID System**:
   - **Connection ID**: Server generates unique ID for each WebSocket connection
   - **Client ID**: Client provides any ID they want for Pub/Sub operations

2. **Smart ID Handling**:
   - Server stores both IDs internally
   - Uses client-provided ID for all Pub/Sub operations
   - Uses connection ID for WebSocket connection tracking

3. **No More Validation Errors**:
   - Clients can use any `client_id` they want
   - Server accepts and validates the client-provided ID
   - No more "Client ID mismatch" errors

4. **Proper Message Flow**:
   ```
   Client → Server: {"type": "subscribe", "client_id": "my_custom_id", ...}
   Server → PubSub: Uses "my_custom_id" for subscription
   Server → Client: {"type": "ack", "status": "ok", ...}
   ```

### **Example Working Messages**

**Subscribe (any client_id works):**
```json
{"type": "subscribe", "topic": "orders", "client_id": "user_123", "request_id": "req-001"}
{"type": "subscribe", "topic": "orders", "client_id": "mobile_app", "request_id": "req-002"}
{"type": "subscribe", "topic": "orders", "client_id": "web_client", "request_id": "req-003"}
```

**Publish (any client_id works):**
```json
{"type": "publish", "topic": "orders", "client_id": "publisher_1", "message": {"id": "msg-001", "payload": {}}, "request_id": "req-004"}
```

## 🚨 Troubleshooting

1. **Port Already in Use**: Change port or kill existing process
2. **WebSocket Connection Failed**: Check server is running and port is correct
3. **Permission Denied**: Make startup script executable with `chmod +x start.sh`
4. **Docker Build Fails**: Ensure Docker is running and you have sufficient permissions

### WebSocket Testing Issues:

1. **Postman WebSocket Connection Fails**:
   - Ensure server is running on correct port
   - Check if firewall is blocking the connection
   - Try using `localhost` instead of `127.0.0.1`

2. **wscat Installation Issues**:
   - Use `npm install -g wscat` (requires Node.js)
   - Alternative: Use browser console or Postman

3. **✅ Client ID Issues - RESOLVED!**:
   - The "Client ID mismatch" error has been completely fixed
   - You can now use **any client_id you want** in your messages
   - The server accepts and uses the client-provided ID for all operations
   - No more validation errors or connection issues

4. **Message Format Errors**:
   - Ensure JSON is valid (use JSON validator)
   - Check that all required fields are present
   - Verify message structure matches protocol specification

5. **Topic Not Found Errors**:
   - Create topics first using REST API
   - Check topic name spelling
   - Verify topic exists using `GET /topics`

### Debug Commands:

```bash
# Check server logs
tail -f logs/app.log

# Check server process
ps aux | grep "node server.js"

# Check port usage
lsof -i :3000

# Check Docker logs
docker logs plivo-test
```

---

**🎉 Congratulations!** If you've completed all tests successfully, your Pub/Sub system is working perfectly and ready for production use!
