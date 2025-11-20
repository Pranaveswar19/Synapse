import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function checkVectorIndex() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Connected");

    const db = mongoose.connection.db;
    const collection = db!.collection("documents");

    console.log("\n📊 Checking for search indexes...");

    try {
      const indexes = await collection.listSearchIndexes().toArray();

      if (indexes.length === 0) {
        console.log("❌ No search indexes found");
      } else {
        console.log(`✅ Found ${indexes.length} search index(es):`);
        indexes.forEach((idx: Record<string, unknown>) => {
          console.log(`\n  Name: ${idx.name}`);
          console.log(`  Status: ${idx.status}`);
          console.log(`  Definition:`, JSON.stringify(idx, null, 2));
        });
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.log("❌ Error listing indexes:", err.message);
      console.log("   This might mean Atlas Search is not enabled");
    }

    await mongoose.connection.close();
    console.log("\n✅ Disconnected");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkVectorIndex();
