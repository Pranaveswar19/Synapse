import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function createSessionIndex() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('documents');

    // Create index on sessionId field
    console.log('📊 Creating index on sessionId field...');
    
    const result = await collection.createIndex(
      { sessionId: 1 },
      { 
        name: 'sessionId_1',
        background: true 
      }
    );

    console.log('✅ Index created successfully:', result);
    console.log('\n🎉 Session index setup complete!');
    console.log('📝 The sessionId field can now be used in aggregation filters.');
    
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating index:', error);
    process.exit(1);
  }
}

createSessionIndex();
