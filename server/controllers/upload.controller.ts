import { Request, Response } from "express";
import { processPDF, processCSV } from "../services/ingestion.service";
import { getUserFriendlyError } from "../utils/error-messages";
import Document from "../models/Document";
import fs from "fs";

export async function handleUpload(req: Request, res: Response) {
  try {
    if (!req.file) {
      const error = getUserFriendlyError("NO_FILE");
      return res.status(400).json({ 
        success: false,
        error: error.message,
        suggestion: error.suggestion
      });
    }

    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required",
        suggestion: "Please refresh the page and try again",
      });
    }

    const file = req.file;
    console.log("📁 File uploaded:");
    console.log("  - Filename:", file.filename);
    console.log("  - Original name:", file.originalname);
    console.log("  - Session ID:", sessionId);
    console.log("  - Path:", file.path);
    console.log("  - Size:", file.size);
    console.log("  - Mimetype:", file.mimetype);

    const fileExists = fs.existsSync(file.path);
    console.log("  - File exists?", fileExists);

    let document;

    if (file.mimetype === "application/pdf") {
      console.log("🔄 Processing PDF...");
      try {
        document = await processPDF(file.path, file.originalname, sessionId);
      } catch (pdfError: unknown) {
        const error = pdfError as { errorType?: string; name?: string; message?: string };
        console.error("PDF processing error:", error);
        
        // Determine the specific error type based on error properties
        let errorCode: "PDF_PARSE_FAILED" | "NO_TEXT_EXTRACTED" | "DB_CONNECTION_FAILED" | "OPENAI_API_ERROR" = "PDF_PARSE_FAILED";
        
        if (error.errorType === 'DATABASE' || error.name === 'MongoServerError' || error.message?.includes('Mongo')) {
          errorCode = "DB_CONNECTION_FAILED";
        } else if (error.errorType === 'NO_TEXT' || error.message?.includes("NO_TEXT_EXTRACTED")) {
          errorCode = "NO_TEXT_EXTRACTED";
        } else if (error.errorType === 'OPENAI_API' || error.message?.includes('OpenAI') || error.message?.includes('API key')) {
          errorCode = "OPENAI_API_ERROR";
        }
        
        const friendlyError = getUserFriendlyError(errorCode, error.message);
        return res.status(500).json({
          success: false,
          error: friendlyError.message,
          suggestion: friendlyError.suggestion,
          ...(friendlyError.technical && { technical: friendlyError.technical }),
        });
      }
    } else if (file.mimetype === "text/csv") {
      console.log("🔄 Processing CSV...");
      try {
        document = await processCSV(file.path, file.originalname, sessionId);
      } catch (csvError: unknown) {
        const error = csvError as { errorType?: string; name?: string; message?: string };
        console.error("CSV processing error:", error);
        
        // Determine the specific error type
        let errorCode: "CSV_PARSE_FAILED" | "DB_CONNECTION_FAILED" | "OPENAI_API_ERROR" = "CSV_PARSE_FAILED";
        
        if (error.errorType === 'DATABASE' || error.name === 'MongoServerError' || error.message?.includes('Mongo')) {
          errorCode = "DB_CONNECTION_FAILED";
        } else if (error.errorType === 'OPENAI_API' || error.message?.includes('OpenAI') || error.message?.includes('API key')) {
          errorCode = "OPENAI_API_ERROR";
        }
        
        const friendlyError = getUserFriendlyError(errorCode, error.message);
        return res.status(500).json({
          success: false,
          error: friendlyError.message,
          suggestion: friendlyError.suggestion,
          ...(friendlyError.technical && { technical: friendlyError.technical }),
        });
      }
    } else {
      const errorResponse = getUserFriendlyError("UNSUPPORTED_FILE");
      return res.status(400).json({
        success: false,
        error: errorResponse.message,
        suggestion: errorResponse.suggestion,
      });
    }

    res.json({
      success: true,
      documentId: document._id,
      filename: document.filename,
      extractedData: document.extractedData,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Upload error:", err);
    const friendlyError = getUserFriendlyError("UNEXPECTED_ERROR", err.message);
    res.status(500).json({
      success: false,
      error: friendlyError.message,
      suggestion: friendlyError.suggestion,
      ...(friendlyError.technical && { technical: friendlyError.technical }),
    });
  }
}

// NEW: Endpoint to clear old documents
export async function handleClearOldDocuments(req: Request, res: Response) {
  try {
    const hoursAgo = parseInt(req.query.hours as string) || 24;
    const cutoffDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    const result = await Document.deleteMany({
      uploadDate: { $lt: cutoffDate }
    });
    
    console.log(`🗑️ Deleted ${result.deletedCount} documents older than ${hoursAgo} hours`);
    
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Deleted ${result.deletedCount} document(s) older than ${hoursAgo} hours`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Clear documents error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to clear old documents",
      details: err.message,
    });
  }
}

// NEW: Endpoint to clear ALL documents (for testing/fresh start)
export async function handleClearAllDocuments(req: Request, res: Response) {
  try {
    const result = await Document.deleteMany({});
    
    console.log(`🗑️ Deleted ALL ${result.deletedCount} documents`);
    
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Deleted all ${result.deletedCount} document(s) from database`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Clear all documents error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to clear all documents",
      details: err.message,
    });
  }
}
