import dotenv from "dotenv";
import path from "path";

// Load environment variables FIRST before any other imports
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Now import modules that depend on env vars
import connectDB from "../config/db";
import Document from "../models/Document";
import { generateEmbedding } from "../services/vector.service";

async function testVectorSearch() {
  console.log("\n🔍 Testing Vector Search Setup...\n");

  try {
    // Step 1: Test MongoDB connection
    console.log("1️⃣ Testing MongoDB connection...");
    await connectDB();
    console.log("   ✅ MongoDB connected successfully\n");

    // Step 2: Check if documents exist
    console.log("2️⃣ Checking for documents...");
    const docCount = await Document.countDocuments();
    console.log(`   📄 Found ${docCount} document(s) in database\n`);

    if (docCount === 0) {
      console.log("   ⚠️  No documents found. Upload a file first!\n");
      process.exit(0);
    }

    // Step 3: Test embedding generation
    console.log("3️⃣ Testing OpenAI embedding generation...");
    const testEmbedding = await generateEmbedding("test query");
    console.log(`   ✅ Generated embedding with ${testEmbedding.length} dimensions\n`);

    // Step 4: Test vector search
    console.log("4️⃣ Testing vector search...");
    const testQuery = "software engineer";
    const queryEmbedding = await generateEmbedding(testQuery);

    const vectorResults = await Document.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "chunks.embedding",
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
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    console.log(`   ✅ Vector search successful! Found ${vectorResults.length} results`);

    if (vectorResults.length > 0) {
      console.log("\n   📊 Top result:");
      console.log(`      File: ${vectorResults[0].filename}`);
      console.log(`      Type: ${vectorResults[0].fileType}`);
      console.log(`      Score: ${(vectorResults[0].score * 100).toFixed(2)}%`);
    }

    console.log("\n✅ All tests passed! Vector search is working correctly.\n");
  } catch (error: any) {
    console.error("\n❌ Test failed with error:\n");
    console.error(error);

    if (error.message?.includes("$vectorSearch")) {
      console.error("\n💡 SOLUTION: Create the vector search index in MongoDB Atlas:");
      console.error("   1. Go to MongoDB Atlas → Your Cluster → Search");
      console.error("   2. Click 'Create Search Index'");
      console.error("   3. Choose 'JSON Editor' and paste:");
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
      console.error("   4. Name it: vector_index");
      console.error("   5. Click 'Create Search Index'\n");
    } else if (error.message?.includes("OpenAI") || error.message?.includes("API key")) {
      console.error("\n💡 SOLUTION: Check your OpenAI API key:");
      console.error("   1. Verify it's valid at https://platform.openai.com/api-keys");
      console.error("   2. Make sure it has credits/quota remaining");
      console.error("   3. Update OPENAI_API_KEY in .env.local\n");
    } else if (error.message?.includes("Mongo") || error.message?.includes("connect")) {
      console.error("\n💡 SOLUTION: Check your MongoDB connection:");
      console.error("   1. Verify MONGODB_URI in .env.local");
      console.error("   2. Check if IP is whitelisted in Atlas (Network Access)");
      console.error("   3. Verify credentials are correct\n");
    }
  } finally {
    process.exit(0);
  }
}

testVectorSearch();
