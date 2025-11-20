import dotenv from "dotenv";
import path from "path";

// Load environment variables FIRST before any other imports
// In production (Render), .env.local won't exist - it uses environment variables directly
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, "../.env.local") });
}

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { handleUpload, handleClearOldDocuments, handleClearAllDocuments } from "./controllers/upload.controller";
import { handleChat } from "./controllers/chat.controller";
import { handleChatStream } from "./controllers/chat-stream.controller";
import { handleSendEmail } from "./controllers/email.controller";
import { validateEnv } from "./config/validate-env";

// Validate environment variables on startup
validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - allow frontend URLs
const allowedOrigins = [
  'http://localhost:3000',
  'https://synapse.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../public/uploads");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("📁 Created uploads directory:", uploadDir);
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "_" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Only allow PDF and CSV files
    const allowedTypes = ['application/pdf', 'text/csv'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and CSV are allowed.'));
    }
  },
});


// Root route
app.get("/", (req, res) => {
  res.json({ 
    message: "Synapse Backend API", 
    version: "1.0.0",
    endpoints: {
      health: "/health",
      upload: "POST /api/upload",
      chat: "POST /api/chat",
      chatStream: "POST /api/chat/stream",
      sendEmail: "POST /api/email/send"
    }
  });
});

app.post("/api/upload", upload.single("file"), handleUpload);
app.post("/api/chat", handleChat);
app.post("/api/chat/stream", handleChatStream);
app.post("/api/email/send", handleSendEmail);

// NEW: Document management endpoints
app.delete("/api/documents/old", handleClearOldDocuments); // Clear documents older than X hours
app.delete("/api/documents/all", handleClearAllDocuments); // Clear ALL documents

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error("Server error:", err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status((err as { status?: number }).status || 500).json({
    error: err.message || "Internal server error",
    ...(isDevelopment && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});
