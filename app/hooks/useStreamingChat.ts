import { useState, useCallback, useRef } from "react";
import { useSessionId } from "./useSessionId";

export interface StreamingMessage {
  role: "user" | "assistant";
  content: string;
  thinking?: string[];
  isStreaming?: boolean;
  emailData?: {
    name: string;
    email: string;
    position: string;
    salary: string;
  };
}

export function useStreamingChat() {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messageIndexRef = useRef<number>(-1);
  const { sessionId } = useSessionId();

  const sendMessage = useCallback(async (message: string) => {
    if (!sessionId) {
      console.error("No session ID available - waiting for initialization");
      // Wait a moment and retry
      setTimeout(() => {
        if (sessionId) {
          sendMessage(message);
        }
      }, 100);
      return;
    }

    const userMessage: StreamingMessage = {
      role: "user",
      content: message,
    };

    setMessages((prev) => {
      messageIndexRef.current = prev.length + 1;
      return [
        ...prev,
        userMessage,
        {
          role: "assistant",
          content: "",
          thinking: [],
          isStreaming: true,
        },
      ];
    });

    setIsStreaming(true);

    try {
      const response = await fetch("http://localhost:3001/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, sessionId }),
      });

      if (!response.ok) {
        throw new Error("Stream request failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No reader available");
      }

      let buffer = "";
      const processedThinking = new Set<string>();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Split by double newline (SSE message separator)
        const messages = buffer.split("\n\n");

        // Keep the last incomplete message in buffer
        buffer = messages.pop() || "";

        for (const msg of messages) {
          if (!msg.trim()) continue;

          // Each SSE message is "data: {...}"
          const lines = msg.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();

              if (!data) continue;

              try {
                const event = JSON.parse(data);

                if (event.type === "thinking") {
                  // Deduplicate thinking steps
                  if (processedThinking.has(event.step)) {
                    continue;
                  }
                  processedThinking.add(event.step);

                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const assistantMsg = newMessages[messageIndexRef.current];

                    if (assistantMsg && assistantMsg.role === "assistant") {
                      const alreadyExists = assistantMsg.thinking?.includes(
                        event.step
                      );
                      if (!alreadyExists) {
                        assistantMsg.thinking = [
                          ...(assistantMsg.thinking || []),
                          event.step,
                        ];
                      }
                    }
                    return newMessages;
                  });
                } else if (event.type === "response") {
                  console.log(`[FRONTEND] Received response chunk: "${event.content}"`);
                  
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const assistantMsg = newMessages[messageIndexRef.current];

                    if (assistantMsg && assistantMsg.role === "assistant") {
                      // Check if this exact content was just added (within last 2 chars)
                      const recentContent = assistantMsg.content.slice(-event.content.length * 2);
                      if (!recentContent.includes(event.content)) {
                        assistantMsg.content += event.content;
                      } else {
                        console.log(`[FRONTEND DEDUP] Skipping duplicate: "${event.content}"`);
                      }
                    }
                    return newMessages;
                  });
                } else if (event.type === "chart") {
                  console.log(`[FRONTEND] Received chart data`);

                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const assistantMsg = newMessages[messageIndexRef.current];

                    if (assistantMsg && assistantMsg.role === "assistant") {
                      // Set the complete chart JSON as content
                      assistantMsg.content = event.content || "";
                    }
                    return newMessages;
                  });
                } else if (event.type === "email_preview") {
                  console.log(`[FRONTEND] Received email preview`);

                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const assistantMsg = newMessages[messageIndexRef.current];

                    if (assistantMsg && assistantMsg.role === "assistant") {
                      // Set the complete email preview JSON as content
                      assistantMsg.content = event.content || "";
                    }
                    return newMessages;
                  });
                } else if (event.type === "done") {
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const assistantMsg = newMessages[messageIndexRef.current];

                    if (assistantMsg && assistantMsg.role === "assistant") {
                      assistantMsg.isStreaming = false;
                    }
                    return newMessages;
                  });
                  setIsStreaming(false);
                } else if (event.type === "error") {
                  console.error("Stream error:", event);
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const assistantMsg = newMessages[messageIndexRef.current];

                    if (assistantMsg && assistantMsg.role === "assistant") {
                      // Create a user-friendly error display
                      assistantMsg.content = JSON.stringify({
                        type: 'ERROR',
                        message: event.message,
                        suggestion: event.suggestion,
                      });
                      assistantMsg.isStreaming = false;
                    }
                    return newMessages;
                  });
                  setIsStreaming(false);
                }
              } catch (e) {
                console.error("Failed to parse event:", data, e);
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Streaming error:", error);
      setMessages((prev) => {
        const newMessages = [...prev];
        const assistantMsg = newMessages[messageIndexRef.current];

        if (assistantMsg && assistantMsg.role === "assistant") {
          assistantMsg.content = `Error: ${error.message}`;
          assistantMsg.isStreaming = false;
        }
        return newMessages;
      });
      setIsStreaming(false);
    }
  }, [sessionId]);

  const sendEmail = useCallback(async (emailData: any) => {
    try {
      const response = await fetch("http://localhost:3001/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        throw new Error("Failed to send email");
      }

      return await response.json();
    } catch (error) {
      console.error("Email send error:", error);
      throw error;
    }
  }, []);

  const cancelEmail = useCallback((messageIndex: number) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      if (newMessages[messageIndex]) {
        newMessages[messageIndex].emailData = undefined;
        newMessages[messageIndex].content = "Email sending cancelled.";
      }
      return newMessages;
    });
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    sendEmail,
    cancelEmail,
  };
}
