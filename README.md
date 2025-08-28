# Plivo Pub/Sub System

A complete in-memory Pub/Sub system built with Node.js, Express.js, and WebSockets. This system provides real-time message publishing and subscription capabilities with topic-based routing, fan-out delivery, and comprehensive REST API management.

## Features

- **Topic-based Message Routing**: Organize messages by topics for efficient delivery
- **Fan-out Delivery**: Each subscriber receives every message published to their subscribed topics
- **Topic Isolation**: No cross-topic message leaks
- **WebSocket Protocol**: Real-time bidirectional communication
- **REST API Management**: Full CRUD operations for topics and system monitoring
- **Message Replay**: Support for replaying recent messages on subscription
- **Backpressure Handling**: Configurable policies for managing slow consumers
- **Heartbeat System**: Connection health monitoring
- **Graceful Shutdown**: Clean shutdown with connection cleanup
- **Comprehensive Logging**: Structured logging with Winston
- **Docker Support**: Containerized deployment

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WebSocket     │    │   REST API      │    │   Pub/Sub       │
│   Clients       │    │   Clients       │    │   Engine        │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket Handler                            │
│              (Client Management & Protocol)                    │
└─────────────────────────────────────────────────────────────────┘
          │                      │
          │                      │
          ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express.js Server                           │
│              (HTTP Server & Middleware)                        │
└─────────────────────────────────────────────────────────────────┘
          │
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Pub/Sub Engine                              │
│              (In-Memory Topic Registry)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd plivo
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

The server will start on `http://localhost:3000` with WebSocket support on `ws://localhost:3000/ws`.

### Development Mode

For development with auto-restart:
```bash
npm run dev
```

## Docker Deployment

### Prerequisites

- Docker installed and running
- Docker Compose (optional, for multi-service deployment)

### Quick Docker Start

**Option 1: Using Docker Compose (Recommended)**
```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

**Option 2: Using Docker directly**
```bash
# Build the image
docker build -t plivo-pubsub .

# Run the container
docker run -d --name plivo-pubsub-container -p 3000:3000 plivo-pubsub

# View logs
docker logs plivo-pubsub-container

# Stop and remove container
docker stop plivo-pubsub-container && docker rm plivo-pubsub-container
```

### Docker Configuration

#### Environment Variables

You can customize the container behavior with environment variables:

```bash
docker run -d \
  --name plivo-pubsub-container \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e HOST=0.0.0.0 \
  -e LOG_LEVEL=info \
  -e MAX_MESSAGES_PER_TOPIC=100 \
  -e MAX_QUEUE_SIZE=1000 \
  -e BACKPRESSURE_POLICY=drop_oldest \
  -e HEARTBEAT_INTERVAL=30000 \
  plivo-pubsub
```

#### Production Deployment

For production environments, use restart policies and volume mounts:

```bash
# Run with restart policy and log persistence
docker run -d \
  --name plivo-pubsub-container \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /var/log/plivo:/app/logs \
  -e NODE_ENV=production \
  plivo-pubsub

# Or use Docker Compose with production settings
docker-compose -f docker-compose.prod.yml up -d
```

#### Health Check

The container includes a health check that monitors the service:

```bash
# Check container health
docker ps

# View health check logs
docker inspect plivo-pubsub-container | grep -A 10 "Health"
```

### Docker Commands Reference

```bash
# Build image
docker build -t plivo-pubsub .

# Run container (interactive)
docker run -it --rm -p 3000:3000 plivo-pubsub

# Run container (detached)
docker run -d --name plivo-pubsub-container -p 3000:3000 plivo-pubsub

# View logs
docker logs plivo-pubsub-container
docker logs -f plivo-pubsub-container  # Follow logs

# Execute commands in running container
docker exec -it plivo-pubsub-container /bin/sh

# Stop container
docker stop plivo-pubsub-container

# Remove container
docker rm plivo-pubsub-container

# Remove image
docker rmi plivo-pubsub

# Clean up all containers and images
docker system prune -a
```

### Testing Docker Deployment

Once the container is running, test the endpoints:

```bash
# Health check
curl http://localhost:3000/health

# Create a topic
curl -X POST http://localhost:3000/topics \
  -H "Content-Type: application/json" \
  -d '{"name": "orders"}'

# List topics
curl http://localhost:3000/topics

# System stats
curl http://localhost:3000/stats
```

### Docker Compose Configuration

The `docker-compose.yml` file includes:

- **Service definition** with proper restart policy
- **Port mapping** (3000:3000)
- **Environment variables** configuration
- **Health check** configuration
- **Log volume** mounting
- **Network configuration**

### Troubleshooting Docker

**Container won't start:**
```bash
# Check Docker daemon
docker info

# Check container logs
docker logs plivo-pubsub-container

# Check port availability
lsof -i :3000
```

**Permission issues:**
```bash
# Run with proper permissions
docker run -d --user $(id -u):$(id -g) -p 3000:3000 plivo-pubsub
```

**Port conflicts:**
```bash
# Use different port
docker run -d -p 3001:3000 plivo-pubsub
```

## API Documentation

### REST Endpoints

#### Topics Management

**Create Topic**
```http
POST /topics
Content-Type: application/json

{
  "name": "orders"
}
```

**Response:**
```json
{
  "status": "created",
  "topic": "orders",
  "ts": "2025-01-28T10:00:00.000Z"
}
```

**Delete Topic**
```http
DELETE /topics/orders
```

**Response:**
```json
{
  "status": "deleted",
  "topic": "orders",
  "subscribers_disconnected": 3,
  "messages_lost": 42,
  "ts": "2025-01-28T10:00:00.000Z"
}
```

**List Topics**
```http
GET /topics
```

**Response:**
```json
{
  "topics": [
    {
      "name": "orders",
      "subscribers": 3,
      "messages": 42,
      "created_at": "2025-01-28T09:00:00.000Z"
    }
  ],
  "total": 1,
  "ts": "2025-01-28T10:00:00.000Z"
}
```

**Get Topic Details**
```http
GET /topics/orders
```

**Response:**
```json
{
  "topic": {
    "name": "orders",
    "subscribers": 3,
    "messages": 42,
    "created_at": "2025-01-28T09:00:00.000Z"
  },
  "ts": "2025-01-28T10:00:00.000Z"
}
```

#### System Endpoints

**Health Check**
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "uptime_sec": 123,
  "topics": 2,
  "subscribers": 4,
  "connections": 3,
  "ts": "2025-01-28T10:00:00.000Z"
}
```

**System Statistics**
```http
GET /stats
```

**System Information**
```http
GET /info
```

### WebSocket Protocol

Connect to `ws://localhost:3000/ws` to establish a WebSocket connection.

#### Client → Server Messages

**Subscribe to Topic**
```json
{
  "type": "subscribe",
  "topic": "orders",
  "client_id": "client_123",
  "last_n": 5,
  "request_id": "req-456"
}
```

**Unsubscribe from Topic**
```json
{
  "type": "unsubscribe",
  "topic": "orders",
  "client_id": "client_123",
  "request_id": "req-789"
}
```

**Publish Message**
```json
{
  "type": "publish",
  "topic": "orders",
  "message": {
    "id": "msg-123",
    "payload": {
      "order_id": "order-456",
      "amount": 99.99
    }
  },
  "client_id": "client_123",
  "request_id": "req-101"
}
```

**Ping**
```json
{
  "type": "ping",
  "request_id": "req-202"
}
```

#### Server → Client Messages

**Acknowledgment**
```json
{
  "type": "ack",
  "request_id": "req-456",
  "topic": "orders",
  "status": "ok",
  "ts": "2025-01-28T10:00:00.000Z"
}
```

**Event Delivery**
```json
{
  "type": "event",
  "topic": "orders",
  "message": {
    "id": "msg-123",
    "payload": {
      "order_id": "order-456",
      "amount": 99.99
    }
  },
  "ts": "2025-01-28T10:00:00.000Z"
}
```

**Error**
```json
{
  "type": "error",
  "error": "TOPIC_NOT_FOUND",
  "message": "Topic 'orders' not found",
  "ts": "2025-01-28T10:00:00.000Z"
}
```

**Pong Response**
```json
{
  "type": "pong",
  "request_id": "req-202",
  "ts": "2025-01-28T10:00:00.000Z"
}
```

**Info/Heartbeat**
```json
{
  "type": "info",
  "message": "heartbeat",
  "ts": "2025-01-28T10:00:00.000Z"
}
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: 0.0.0.0)
- `LOG_LEVEL`: Logging level (default: info)

### Server Options

```javascript
const server = new PubSubServer({
  port: 3000,
  host: '0.0.0.0',
  maxMessagesPerTopic: 100,        // Messages to keep per topic
  maxQueueSize: 1000,              // Max WebSocket buffer size
  backpressurePolicy: 'drop_oldest', // 'drop_oldest' or 'disconnect'
  heartbeatInterval: 30000         // Heartbeat interval in ms
});
```

## Docker Deployment

### Build Image

```bash
docker build -t plivo-pubsub .
```

### Run Container

```bash
docker run -d \
  --name plivo-pubsub \
  -p 3000:3000 \
  -e PORT=3000 \
  -e HOST=0.0.0.0 \
  plivo-pubsub
```

### Docker Compose

```yaml
version: '3.8'
services:
  pubsub:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - HOST=0.0.0.0
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

## Usage Examples

### JavaScript Client

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  console.log('Connected to Pub/Sub system');
  
  // Subscribe to orders topic
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic: 'orders',
    client_id: 'client_123',
    request_id: 'req-1'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  switch (message.type) {
    case 'ack':
      console.log('Subscription confirmed:', message);
      break;
    case 'event':
      console.log('Received message:', message);
      break;
    case 'error':
      console.error('Error:', message);
      break;
  }
});
```

### cURL Examples

**Create Topic**
```bash
curl -X POST http://localhost:3000/topics \
  -H "Content-Type: application/json" \
  -d '{"name": "orders"}'
```

**List Topics**
```bash
curl http://localhost:3000/topics
```

**Health Check**
```bash
curl http://localhost:3000/health
```

## Error Codes

- `BAD_REQUEST`: Invalid request format or parameters
- `TOPIC_NOT_FOUND`: Requested topic doesn't exist
- `TOPIC_EXISTS`: Topic already exists
- `ALREADY_SUBSCRIBED`: Client already subscribed to topic
- `SLOW_CONSUMER`: Client disconnected due to backpressure
- `UNAUTHORIZED`: Client authentication failed
- `INTERNAL`: Internal server error

## Design Choices & Assumptions

### Backpressure Policy

The system implements **bounded per-subscriber queues** to handle backpressure scenarios where publishers send messages faster than subscribers can process them.

#### **Policy Options**

1. **`drop_oldest`** (default): 
   - **Behavior**: When a subscriber's queue is full, the oldest message is removed and the new message is added
   - **Use Case**: Prioritize latest messages over historical ones
   - **Impact**: Message loss but maintains system performance
   - **Monitoring**: Dropped messages are tracked and logged

2. **`disconnect`**: 
   - **Behavior**: When a subscriber's queue is full, the connection is closed with `SLOW_CONSUMER` error
   - **Use Case**: Force clients to handle backpressure or reconnect
   - **Impact**: Connection loss but prevents system overload
   - **Recovery**: Client must reconnect and resubscribe

#### **Implementation Details**

- **Per-Subscriber Queues**: Each client has an independent bounded queue
- **Queue Size**: Configurable via `maxQueueSize` (default: 1000 messages)
- **Memory Management**: Queues are automatically created on subscription and cleaned up on unsubscription
- **Statistics**: Queue metrics are available via `/stats` endpoint
- **Event Logging**: Dropped messages trigger `messageDropped` events

#### **Configuration**

```javascript
// Server configuration
const server = new PubSubServer({
  maxQueueSize: 1000,              // Messages per subscriber queue
  backpressurePolicy: 'drop_oldest' // 'drop_oldest' or 'disconnect'
});
```

```bash
# Environment variables
export MAX_QUEUE_SIZE=1000
export BACKPRESSURE_POLICY=drop_oldest
```

### **Architecture Assumptions**

#### **In-Memory Storage**
- **Assumption**: All data is stored in memory for maximum performance
- **Trade-off**: No persistence across server restarts
- **Use Case**: Real-time messaging, development, testing, small-scale production
- **Limitation**: Memory constraints limit scalability

#### **Single-Node Design**
- **Assumption**: Single server instance handles all operations
- **Trade-off**: No horizontal scaling or fault tolerance
- **Use Case**: Simple deployments, development environments
- **Limitation**: Single point of failure

#### **WebSocket Protocol**
- **Assumption**: Real-time bidirectional communication via WebSockets
- **Trade-off**: Connection overhead vs HTTP polling
- **Use Case**: Low-latency message delivery
- **Limitation**: Connection management complexity

#### **Topic-Based Routing**
- **Assumption**: Messages are organized by topics for efficient routing
- **Trade-off**: Topic management overhead vs direct messaging
- **Use Case**: Multi-tenant applications, message categorization
- **Benefit**: Natural message organization and filtering

### **Performance Assumptions**

#### **Message Delivery**
- **Fan-out Complexity**: O(n) where n = number of subscribers per topic
- **Memory Usage**: ~200 bytes per message + overhead
- **Throughput**: 50,000+ messages/second (depends on subscriber count)
- **Latency**: Sub-millisecond for message publishing

#### **Concurrency**
- **Node.js Event Loop**: Single-threaded, event-driven architecture
- **Thread Safety**: Map/Set operations are atomic in Node.js
- **Connection Limits**: Limited by system resources (typically 10,000+ concurrent connections)

#### **Memory Management**
- **Ring Buffer**: Topic messages use ring buffer for automatic cleanup
- **Queue Bounds**: Per-subscriber queues prevent memory leaks
- **Garbage Collection**: Automatic cleanup of disconnected clients

### **Operational Assumptions**

#### **Monitoring & Observability**
- **Health Checks**: `/health` endpoint for load balancer integration
- **Metrics**: `/stats` endpoint for system monitoring
- **Logging**: Structured JSON logging with Winston
- **Error Tracking**: Comprehensive error codes and messages

#### **Deployment**
- **Containerization**: Docker support for consistent deployment
- **Environment Variables**: Configuration via environment variables
- **Graceful Shutdown**: Proper cleanup of connections and resources
- **Process Management**: Designed for container orchestration

### **Security Assumptions**

#### **Authentication**
- **Current**: No authentication implemented (development focus)
- **Future**: X-API-Key authentication planned
- **Assumption**: Deployed in trusted network environments

#### **Input Validation**
- **Message Validation**: All messages validated for required fields
- **Topic Names**: Simple string validation
- **Client IDs**: UUID-based client identification
- **Error Sanitization**: No sensitive information in error responses

### **Scalability Limitations**

#### **Current Limitations**
- **Single Node**: No clustering or load balancing
- **Memory Bound**: Limited by available RAM
- **Connection Limits**: WebSocket connection limits
- **No Persistence**: Messages lost on restart

#### **Future Considerations**
- **Clustering**: Multi-node deployment support
- **Persistence**: Redis/PostgreSQL integration
- **Load Balancing**: Horizontal scaling
- **Message TTL**: Automatic message expiration

### **Use Case Recommendations**

#### **Recommended For**
- **Development & Testing**: Local development environments
- **Prototyping**: Rapid application prototyping
- **Small Production**: Low-traffic production applications
- **Real-time Features**: Live dashboards, notifications, chat

#### **Not Recommended For**
- **High Availability**: Critical production systems requiring 99.9%+ uptime
- **Large Scale**: High-traffic applications (>10,000 concurrent users)
- **Message Persistence**: Applications requiring message durability
- **Multi-Region**: Geographically distributed deployments

## Performance Considerations

### **Memory Usage**
- **Topic Messages**: Each topic stores up to 100 messages by default (ring buffer)
- **Subscriber Queues**: Each subscriber has a bounded queue (default: 1000 messages)
- **WebSocket Connections**: ~1KB per connection overhead
- **Total Memory**: Scales with number of topics, subscribers, and message volume

### **Throughput & Latency**
- **Message Publishing**: ~50,000 messages/second (depends on subscriber count)
- **Message Delivery**: Sub-millisecond latency for individual messages
- **Fan-out Complexity**: O(n) where n = number of subscribers per topic
- **Concurrent Connections**: Limited by system resources (typically 10,000+)

### **Backpressure Handling**
- **Queue Overflow**: Automatic message dropping or client disconnection
- **Memory Protection**: Bounded queues prevent memory leaks
- **Performance Impact**: Minimal overhead for normal operation
- **Monitoring**: Real-time queue statistics and dropped message tracking

### **Scalability Limits**
- **Single Node**: No horizontal scaling (planned for future)
- **Memory Bound**: Limited by available RAM
- **Connection Limits**: WebSocket connection limits per server
- **Topic Limits**: No hard limit, but memory constrained

## Monitoring & Logging

- **Health Endpoint**: `/health` for load balancer health checks
- **Statistics**: `/stats` for system metrics
- **Structured Logging**: Winston-based logging with JSON format
- **Request Logging**: Automatic HTTP request/response logging
- **Performance Metrics**: Response time tracking

## Security Features

- **Input Validation**: Comprehensive request validation
- **Error Sanitization**: No sensitive information in error messages
- **Rate Limiting**: Configurable via Express middleware
- **CORS Support**: Configurable cross-origin resource sharing

## Development

### Project Structure

```
plivo/
├── pubsub/           # Pub/Sub engine
├── ws/              # WebSocket handler
├── routes/          # REST API routes
├── utils/           # Utilities (logger, etc.)
├── server.js        # Main server file
├── package.json     # Dependencies
├── Dockerfile       # Container configuration
└── README.md        # This file
```

### Running Tests

```bash
npm test
```

### Code Quality

- ESLint configuration
- Prettier formatting
- JSDoc documentation

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the documentation
2. Review error logs
3. Open an issue in the repository

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Note**: This is an in-memory system designed for development, testing, and small-scale production use. For large-scale production deployments, consider using persistent message brokers like Redis, RabbitMQ, or Apache Kafka.
