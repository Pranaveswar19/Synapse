import mongoose from "mongoose";

// Global variable to cache the connection
interface CachedConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const cached: CachedConnection = (global as { mongoose?: CachedConnection }).mongoose || { conn: null, promise: null };

if (!(global as { mongoose?: CachedConnection }).mongoose) {
  (global as { mongoose: CachedConnection }).mongoose = cached;
}

async function connectDB() {
  // Check for MONGODB_URI when function is called, not at module load
  const MONGODB_URI = process.env.MONGODB_URI || "";
  
  if (!MONGODB_URI) {
    throw new Error("Please define MONGODB_URI in .env.local");
  }

  // If already connected, return cached connection
  if (cached.conn) {
    const dbName = cached.conn.connection.db?.databaseName;
    console.log(`✅ Using cached MongoDB connection to: ${dbName}`);
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      dbName: "synapse", // FORCE synapse database
    };

    console.log("🔌 Connecting to MongoDB...");
    console.log(`   URI: ${MONGODB_URI.substring(0, 50)}...`);
    console.log(`   Forcing database: synapse`);

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongoose) => {
        const dbName = mongoose.connection.db?.databaseName;
        console.log("✅ MongoDB connected successfully");
        console.log(`   Active database: ${dbName}`);

        if (dbName !== "synapse") {
          console.warn(
            `⚠️  WARNING: Connected to "${dbName}" instead of "synapse"`
          );
        }

        return mongoose;
      })
      .catch((error: Error) => {
        console.error("❌ MongoDB connection failed:", error.message);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
