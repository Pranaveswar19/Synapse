'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStreamingChat } from '../hooks/useStreamingChat';
import ThinkingDisplay from './ThinkingDisplay';
import { isChartData } from '../types/chart';
import ChartRenderer from './charts/ChartRenderer';
import EmailPreviewWidget from './EmailPreviewWidget';

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const [cancelledEmails, setCancelledEmails] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, isStreaming, sendMessage, cancelEmail } = useStreamingChat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleSendEmail = async (emailData: any) => {
    try {
      const response = await fetch('http://localhost:3001/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      console.log('Email sent successfully');
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };

  const handleCancelEmail = (messageIndex: number) => {
    setCancelledEmails(prev => new Set(prev).add(messageIndex));
    cancelEmail(messageIndex);
  };

  const renderMessageContent = (content: string, messageIndex: number) => {
    // Check if content is chart data
    const chartData = isChartData(content);
    if (chartData) {
      return <ChartRenderer chartData={chartData} />;
    }

    // Check if content is email preview
    if (content.includes('EMAIL_PREVIEW') && !cancelledEmails.has(messageIndex)) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.type === 'EMAIL_PREVIEW' && parsed.emailData) {
          return (
            <EmailPreviewWidget
              emailData={parsed.emailData}
              onSend={() => handleSendEmail(parsed.emailData)}
              onCancel={() => handleCancelEmail(messageIndex)}
            />
          );
        }
      } catch (e) {
        // Not valid JSON, render as text
      }
    }

    // Check if content is error
    if (content.includes('ERROR')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.type === 'ERROR') {
          return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800">
                    {parsed.message}
                  </h3>
                  {parsed.suggestion && (
                    <p className="text-sm text-red-700 mt-2">
                      💡 {parsed.suggestion}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        }
      } catch (e) {
        // Not valid JSON, render as text
      }
    }

    // Regular text content
    return <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap text-left">{content}</p>;
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-orange-50 via-orange-100/50 to-amber-50 dark:from-gray-950 dark:via-purple-950 dark:to-violet-950 transition-all duration-500">
      {/* Header */}
      <div className="bg-white/95 dark:bg-purple-900/50 backdrop-blur-md border-b border-orange-200/50 dark:border-purple-500/30 shadow-lg dark:shadow-purple-500/20 transition-all duration-500">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 dark:from-purple-400 dark:to-purple-300 bg-clip-text text-transparent">
              Synapse AI Assistant
            </h1>
            <p className="text-sm text-gray-700 dark:text-purple-200 font-medium mt-1">
              Agentic Knowledge Workspace
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="text-7xl mb-6">🤖</div>
              <h2 className="text-3xl font-bold text-gray-800 dark:text-purple-100 mb-3">
                Welcome to Synapse
              </h2>
              <p className="text-gray-600 dark:text-purple-200 max-w-md mx-auto text-lg">
                Upload documents and ask questions. I'll analyze, compare, visualize data, and even send emails on your behalf.
              </p>
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <div className="bg-white/80 dark:bg-purple-800/30 p-5 rounded-xl shadow-md border border-orange-200 dark:border-purple-500/40 hover:shadow-lg hover:scale-105 transition-all duration-300">
                  <p className="text-sm font-medium text-gray-700 dark:text-purple-100">💡 "What are the candidate's key skills?"</p>
                </div>
                <div className="bg-white/80 dark:bg-purple-800/30 p-5 rounded-xl shadow-md border border-orange-200 dark:border-purple-500/40 hover:shadow-lg hover:scale-105 transition-all duration-300">
                  <p className="text-sm font-medium text-gray-700 dark:text-purple-100">📊 "Analyze the sales trends in my CSV"</p>
                </div>
                <div className="bg-white/80 dark:bg-purple-800/30 p-5 rounded-xl shadow-md border border-orange-200 dark:border-purple-500/40 hover:shadow-lg hover:scale-105 transition-all duration-300">
                  <p className="text-sm font-medium text-gray-700 dark:text-purple-100">✉️ "Send offer letter for Senior Engineer"</p>
                </div>
                <div className="bg-white/80 dark:bg-purple-800/30 p-5 rounded-xl shadow-md border border-orange-200 dark:border-purple-500/40 hover:shadow-lg hover:scale-105 transition-all duration-300">
                  <p className="text-sm font-medium text-gray-700 dark:text-purple-100">📈 "Compare revenue across quarters"</p>
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-2xl px-6 py-4 shadow-lg transition-all duration-300 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-orange-600 to-orange-500 dark:from-purple-600 dark:to-purple-500 text-white shadow-orange-500/30 dark:shadow-purple-500/30'
                      : 'bg-white/95 dark:bg-purple-800/40 border border-orange-200/50 dark:border-purple-500/40 backdrop-blur-sm'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <ThinkingDisplay 
                      steps={message.thinking || []} 
                      isActive={message.isStreaming || false}
                    />
                  )}
                  
                  {message.content && (
                    <div className={message.role === 'user' ? 'text-white' : 'text-left'}>
                      {message.role === 'user' ? (
                        <p className="text-white leading-relaxed">{message.content}</p>
                      ) : (
                        renderMessageContent(message.content, index)
                      )}
                    </div>
                  )}

                  {message.isStreaming && !message.content && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full"
                      />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white/95 dark:bg-purple-900/50 border-t border-orange-200/50 dark:border-purple-500/30 shadow-xl dark:shadow-purple-500/20 backdrop-blur-md transition-all duration-500">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your documents..."
              disabled={isStreaming}
              className="flex-1 px-5 py-4 border-2 border-orange-300 dark:border-purple-500/50 bg-white dark:bg-purple-800/30 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-purple-400 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-purple-900/30 disabled:cursor-not-allowed transition-all duration-300"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-8 py-4 bg-gradient-to-r from-orange-600 to-orange-500 dark:from-purple-600 dark:to-purple-500 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100"
            >
              {isStreaming ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                'Send'
              )}
            </button>
          </form>

          {isStreaming && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-orange-600 dark:text-purple-300 mt-3 text-center font-medium"
            >
              AI is processing your request...
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}