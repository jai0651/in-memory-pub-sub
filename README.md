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

## Backpressure Policy

The system supports two backpressure handling policies:

1. **`drop_oldest`** (default): Drops the oldest message when buffer is full
2. **`disconnect`**: Disconnects the client with `SLOW_CONSUMER` error

Configure via server options or environment variables.

## Performance Considerations

- **Memory Usage**: Each topic stores up to 100 messages by default
- **WebSocket Buffer**: Maximum 1000 bytes per connection
- **Concurrent Connections**: Limited by system resources
- **Message Delivery**: Fan-out to all subscribers (O(n) complexity)

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
