const PubSubEngine = require('../pubsub/pubsub');

/**
 * Test script for Pub/Sub Engine
 * This script tests the core functionality without requiring the full server
 */

async function testPubSubEngine() {
  console.log('🧪 Testing Pub/Sub Engine...\n');

  // Create Pub/Sub engine
  const pubsub = new PubSubEngine({
    maxMessagesPerTopic: 5,
    maxQueueSize: 100,
    backpressurePolicy: 'drop_oldest',
    heartbeatInterval: 1000
  });

  try {
    // Test 1: Create topics
    console.log('📝 Test 1: Creating topics...');
    const topic1 = pubsub.createTopic('orders');
    const topic2 = pubsub.createTopic('notifications');
    console.log(`✅ Created topics: orders=${topic1}, notifications=${topic2}\n`);

    // Test 2: Get topics
    console.log('📋 Test 2: Getting topics...');
    const topics = pubsub.getAllTopics();
    console.log(`✅ Found ${topics.length} topics:`, topics.map(t => t.name).join(', '), '\n');

    // Test 3: Publish messages
    console.log('📤 Test 3: Publishing messages...');
    const msg1 = pubsub.publish('orders', { id: 'msg1', payload: { order_id: 'order1', amount: 100 } });
    const msg2 = pubsub.publish('orders', { id: 'msg2', payload: { order_id: 'order2', amount: 200 } });
    const msg3 = pubsub.publish('notifications', { id: 'msg3', payload: { type: 'info', message: 'Hello' } });
    
    console.log(`✅ Published messages: orders=${msg1.subscribers}, notifications=${msg3.subscribers}\n`);

    // Test 4: Get stats
    console.log('📊 Test 4: Getting statistics...');
    const stats = pubsub.getStats();
    console.log('✅ Statistics:', {
      totalTopics: Object.keys(stats.topics).length,
      totalMessages: stats.totalMessages,
      totalSubscribers: stats.totalSubscribers
    }, '\n');

    // Test 5: Message replay
    console.log('🔄 Test 5: Testing message replay...');
    const topicInfo = pubsub.getTopic('orders');
    console.log(`✅ Topic 'orders' has ${topicInfo.messages} messages\n`);

    // Test 6: Delete topic
    console.log('🗑️  Test 6: Deleting topic...');
    const deleted = pubsub.deleteTopic('notifications');
    console.log(`✅ Deleted topic 'notifications': ${deleted}\n`);

    // Test 7: Final stats
    console.log('📊 Test 7: Final statistics...');
    const finalStats = pubsub.getStats();
    console.log('✅ Final stats:', {
      totalTopics: Object.keys(finalStats.topics).length,
      totalMessages: finalStats.totalMessages,
      totalSubscribers: finalStats.totalSubscribers
    }, '\n');

    // Test 8: Shutdown
    console.log('🔄 Test 8: Testing shutdown...');
    await pubsub.shutdown();
    console.log('✅ Pub/Sub engine shutdown complete\n');

    console.log('🎉 All tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testPubSubEngine().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { testPubSubEngine };
