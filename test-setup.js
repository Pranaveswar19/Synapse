require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const { OpenAIEmbeddings } = require('@langchain/openai');

async function testSetup() {
  console.log('\n🔍 Testing Synapse Setup...\n');

  try {
    // Step 1: Check environment variables
    console.log('1️⃣ Checking environment variables...');
    const hasMongoUri = !!process.env.MONGODB_URI;
    const hasOpenAiKey = !!process.env.OPENAI_API_KEY;

    console.log(`   MongoDB URI: ${hasMongoUri ? '✅ Found' : '❌ Missing'}`);
    console.log(`   OpenAI API Key: ${hasOpenAiKey ? '✅ Found' : '❌ Missing'}\n`);

    if (!hasMongoUri || !hasOpenAiKey) {
      console.error('❌ Missing required environment variables in .env.local\n');
      process.exit(1);
    }

    // Step 2: Test MongoDB connection
    console.log('2️⃣ Testing MongoDB connection...');
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'synapse'
    });
    console.log('   ✅ MongoDB connected successfully\n');

    // Step 3: Check for documents
    console.log('3️⃣ Checking for documents...');
    const DocumentModel = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));
    const docCount = await DocumentModel.countDocuments();
    console.log(`   📄 Found ${docCount} document(s) in database\n`);

    if (docCount === 0) {
      console.log('   ⚠️  No documents found. Upload a file first!\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Step 4: Test OpenAI embedding
    console.log('4️⃣ Testing OpenAI API...');
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-small',
    });
    const testEmbedding = await embeddings.embedQuery('test');
    console.log(`   ✅ Generated embedding with ${testEmbedding.length} dimensions\n`);

    // Step 5: Test vector search
    console.log('5️⃣ Testing vector search...');
    const queryEmbedding = await embeddings.embedQuery('software engineer');

    const results = await DocumentModel.aggregate([
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'chunks.embedding',
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: 5,
        },
      },
      {
        $project: {
          _id: 1,
          filename: 1,
          fileType: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);

    console.log(`   ✅ Vector search successful! Found ${results.length} results`);

    if (results.length > 0) {
      console.log('\n   📊 Top result:');
      console.log(`      File: ${results[0].filename}`);
      console.log(`      Type: ${results[0].fileType}`);
      console.log(`      Score: ${(results[0].score * 100).toFixed(2)}%`);
    }

    console.log('\n✅ All tests passed! Everything is working correctly.\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:\n');
    console.error(error.message);

    if (error.message?.includes('$vectorSearch') || error.message?.includes('vector_index')) {
      console.error('\n💡 SOLUTION: Create the vector search index in MongoDB Atlas:');
      console.error('   1. Go to MongoDB Atlas → Your Cluster → Search');
      console.error('   2. Click "Create Search Index"');
      console.error('   3. Choose "JSON Editor" and paste:');
      console.error(`
{
  "fields": [
    {
      "type": "vector",
      "path": "chunks.embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
`);
      console.error('   4. Name it: vector_index');
      console.error('   5. Database: synapse');
      console.error('   6. Collection: documents');
      console.error('   7. Click "Create Search Index" and wait for it to build\n');
    } else if (error.message?.includes('401') || error.message?.includes('API key')) {
      console.error('\n💡 SOLUTION: Invalid OpenAI API key');
      console.error('   1. Check https://platform.openai.com/api-keys');
      console.error('   2. Verify the key has credits/quota');
      console.error('   3. Update OPENAI_API_KEY in .env.local\n');
    }

    try {
      await mongoose.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    process.exit(1);
  }
}

testSetup();
