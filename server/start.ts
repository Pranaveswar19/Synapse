import dotenv from "dotenv";
import path from "path";

// Load environment variables FIRST before any other imports
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Now import and start the server
import("./index");
