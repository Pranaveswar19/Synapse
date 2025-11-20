import { Request, Response } from "express";
import { runAgent } from "../services/agent.service";
import Chat from "../models/Chat";
import connectDB from "../config/db";

export async function handleChat(req: Request, res: Response) {
  try {
    await connectDB();

    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    let chat = await Chat.findOne({ sessionId });

    if (!chat) {
      chat = await Chat.create({
        sessionId,
        messages: [],
      });
    }

    const conversationHistory = chat.messages.map((msg: { role: string; content: string }) => ({
      role: msg.role,
      content: msg.content,
    }));

    const agentResult = await runAgent(message, conversationHistory);

    chat.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    chat.messages.push({
      role: "assistant",
      content: agentResult.response,
      timestamp: new Date(),
      thinking: agentResult.thinking,
    });

    await chat.save();

    res.json({
      response: agentResult.response,
      thinking: agentResult.thinking,
      emailSent: agentResult.emailSent,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
}
