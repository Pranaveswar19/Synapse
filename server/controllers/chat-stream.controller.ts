import { Request, Response } from "express";
import { runAgentStream } from "../services/agent-stream.service";
import { getUserFriendlyError } from "../utils/error-messages";

export async function handleChatStream(req: Request, res: Response) {
  const { message, sessionId } = req.body;

  if (!message || !message.trim()) {
    const error = getUserFriendlyError("EMPTY_MESSAGE");
    return res.status(400).json({ 
      error: error.message,
      suggestion: error.suggestion
    });
  }

  if (!sessionId) {
    return res.status(400).json({ 
      error: "Session ID is required",
      suggestion: "Please refresh the page and try again"
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    await runAgentStream(message, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }, sessionId);

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Stream error:", err);
    console.error("   Error name:", err.name);
    console.error("   Error message:", err.message);
    console.error("   Error stack:", err.stack);

    // Determine error type and provide friendly message
    let friendlyError;
    if (err.message?.includes('OpenAI') || err.message?.includes('API')) {
      friendlyError = getUserFriendlyError("OPENAI_API_ERROR", err.message);
    } else if (err.message?.includes('database') || err.message?.includes('MongoDB')) {
      friendlyError = getUserFriendlyError("DB_CONNECTION_FAILED", err.message);
    } else if (err.message?.includes('vector') || err.message?.includes('search')) {
      friendlyError = getUserFriendlyError("VECTOR_SEARCH_FAILED", err.message);
    } else {
      friendlyError = getUserFriendlyError("UNEXPECTED_ERROR", err.message || "An unknown error occurred");
    }

    const errorEvent = {
      type: "error",
      message: friendlyError.message,
      suggestion: friendlyError.suggestion,
      ...(friendlyError.technical && { technical: friendlyError.technical }),
    };

    console.error("   Sending error event:", errorEvent);

    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
  }
}
