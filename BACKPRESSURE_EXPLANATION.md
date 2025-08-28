# 🔄 Backpressure Handling: `drop_oldest` Policy Explained

## 📋 Overview

The `drop_oldest` backpressure policy is designed to handle situations where a client is consuming messages slower than they are being published. This document explains how it works, its limitations, and implementation details.

## 🎯 What is Backpressure?

**Backpressure** occurs when:
- **Publishers** are sending messages faster than **subscribers** can process them
- The WebSocket's internal buffer (`ws.bufferedAmount`) exceeds the configured threshold
- The client becomes a "slow consumer"

## 🔍 How `drop_oldest` Policy Works

### **1. Detection Phase**

```javascript
// Check if WebSocket buffer is full
if (ws.bufferedAmount > this.maxQueueSize) {
  // Backpressure detected!
}
```

**What happens:**
- `ws.bufferedAmount` represents bytes waiting to be sent to the client
- `maxQueueSize` is the threshold (default: 1000 bytes)
- When buffer exceeds threshold → backpressure detected

### **2. Policy Decision**

```javascript
if (this.backpressurePolicy === 'drop_oldest') {
  // Log the dropped message for monitoring
  this.logger.warn('Backpressure detected - dropping message due to drop_oldest policy', {
    bufferedAmount: ws.bufferedAmount,
    maxQueueSize: this.maxQueueSize,
    messageId: message.message?.id || 'unknown'
  });
  return false; // Drop the current message
}
```

**What happens:**
- Current message is **dropped** (not sent)
- Warning is logged with details
- `false` is returned to indicate failure

### **3. Message Flow**

```
Publisher → Pub/Sub Engine → WebSocket Handler → Backpressure Check → ❌ DROP
```

## ⚠️ Important Limitations

### **WebSocket API Constraints**

The WebSocket API has a fundamental limitation: **you cannot directly clear the `bufferedAmount`**. This means:

1. **Cannot remove old messages** from the WebSocket buffer
2. **Cannot implement true "drop oldest"** behavior
3. **Must wait** for the client to process messages naturally

### **What Actually Happens**

```javascript
// ❌ NOT POSSIBLE with WebSocket API
ws.bufferedAmount = 0;  // This doesn't exist!
ws.clearBuffer();       // This doesn't exist!
```

**Instead, the policy:**
1. **Drops the NEW message** (not the oldest)
2. **Logs the event** for monitoring
3. **Waits for buffer to clear** naturally

## 🔧 Implementation Details

### **Configuration**

```javascript
// In PubSubEngine constructor
this.maxQueueSize = 1000;              // 1KB buffer threshold
this.backpressurePolicy = 'drop_oldest'; // Policy choice
```

### **Message Delivery Process**

```javascript
// In publish() method
for (const [clientId, ws] of topic.subscribers) {
  const result = this.sendToClient(ws, message);
  deliveryResults.push({ clientId, success: result });
}
```

### **Backpressure Check**

```javascript
// In sendToClient() method
if (ws.bufferedAmount > this.maxQueueSize) {
  if (this.backpressurePolicy === 'drop_oldest') {
    // Log and drop
    this.logger.warn('Backpressure detected...');
    return false;
  }
}
```

## 📊 Monitoring & Observability

### **Log Messages**

When backpressure occurs, you'll see logs like:

```json
{
  "level": "warn",
  "message": "Backpressure detected - dropping message due to drop_oldest policy",
  "bufferedAmount": 1500,
  "maxQueueSize": 1000,
  "messageId": "msg-123",
  "timestamp": "2025-08-28T10:00:00Z"
}
```

### **Delivery Results**

The publish method returns delivery results:

```javascript
{
  success: true,
  subscribers: 3,
  deliveryResults: [
    { clientId: "client1", success: true },
    { clientId: "client2", success: false },  // Backpressure dropped this
    { clientId: "client3", success: true }
  ]
}
```

## 🚀 Alternative Approaches

### **1. True Drop Oldest (Advanced)**

```javascript
// Would require custom message queue per client
class ClientMessageQueue {
  constructor(maxSize) {
    this.queue = [];
    this.maxSize = maxSize;
  }
  
  add(message) {
    if (this.queue.length >= this.maxSize) {
      this.queue.shift(); // Remove oldest
    }
    this.queue.push(message);
  }
}
```

### **2. Connection Reset**

```javascript
// Force client to reconnect
if (backpressure) {
  ws.close(1013, 'SLOW_CONSUMER');
  // Client will reconnect and catch up
}
```

### **3. Rate Limiting**

```javascript
// Limit message rate per client
const rateLimiter = new Map();
const maxMessagesPerSecond = 100;

if (rateLimiter.get(clientId) > maxMessagesPerSecond) {
  return false; // Drop message
}
```

## 🎯 Best Practices

### **1. Monitor Backpressure Events**

```javascript
// Set up monitoring
pubsubEngine.on('backpressure', (clientId, topic, messageId) => {
  console.log(`Backpressure for client ${clientId} on topic ${topic}`);
});
```

### **2. Adjust Thresholds**

```javascript
// Increase threshold for high-throughput scenarios
const pubsub = new PubSubEngine({
  maxQueueSize: 5000,  // 5KB instead of 1KB
  backpressurePolicy: 'drop_oldest'
});
```

### **3. Client-Side Handling**

```javascript
// Client should implement flow control
ws.onmessage = (event) => {
  // Process message quickly
  // Send flow control signals if needed
};
```

## 🔍 Troubleshooting

### **Common Issues**

1. **Too Many Dropped Messages**
   - **Cause**: Clients too slow
   - **Solution**: Increase `maxQueueSize` or improve client performance

2. **No Backpressure Detection**
   - **Cause**: Threshold too high
   - **Solution**: Decrease `maxQueueSize`

3. **Client Disconnections**
   - **Cause**: Using `disconnect` policy
   - **Solution**: Switch to `drop_oldest` policy

### **Debugging Commands**

```bash
# Monitor WebSocket buffer sizes
curl -X GET http://localhost:3000/stats

# Check for backpressure logs
grep "Backpressure detected" server.log
```

## 📈 Performance Impact

### **Memory Usage**

- **Low Impact**: Dropped messages don't consume memory
- **Buffer Monitoring**: `ws.bufferedAmount` is a built-in metric

### **Throughput**

- **Maintained**: System continues processing other clients
- **Selective**: Only slow clients are affected

### **Latency**

- **Improved**: Fast clients aren't blocked by slow ones
- **Isolated**: Each client's performance is independent

## 🎉 Summary

The `drop_oldest` backpressure policy:

✅ **Prevents system overload** by dropping messages when clients are slow  
✅ **Maintains performance** for fast clients  
✅ **Provides monitoring** through logging  
✅ **Is configurable** via `maxQueueSize` and policy selection  

❌ **Cannot truly drop oldest** due to WebSocket API limitations  
❌ **Drops new messages** instead of old ones  
❌ **Requires client cooperation** for optimal performance  

**Recommendation**: Use this policy when you want to prioritize system stability over message delivery guarantees for slow consumers.
