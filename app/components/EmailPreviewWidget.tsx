'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface EmailPreviewWidgetProps {
  emailData: {
    name: string;
    email: string;
    position: string;
    salary: string;
  };
  onSend: () => void;
  onCancel: () => void;
}

export default function EmailPreviewWidget({ 
  emailData, 
  onSend, 
  onCancel 
}: EmailPreviewWidgetProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setSending(true);
    await onSend();
    setSent(true);
    
    // Hide widget after 2 seconds
    setTimeout(() => {
      setSending(false);
    }, 2000);
  };

  if (sent) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-green-50 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-600 rounded-2xl p-8 text-center backdrop-blur-sm transition-all duration-300"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="text-7xl mb-4"
        >
          ✅
        </motion.div>
        <h3 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">
          Email Sent Successfully!
        </h3>
        <p className="text-green-700 dark:text-green-300 text-lg">
          Offer letter sent to {emailData.email}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-purple-900/40 dark:to-purple-800/40 border-2 border-orange-300 dark:border-purple-500/50 rounded-2xl p-6 shadow-xl dark:shadow-purple-500/20 backdrop-blur-sm transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="text-4xl">📧</div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-purple-100">
              Email Preview
            </h3>
            <p className="text-sm text-gray-600 dark:text-purple-200 font-medium">
              Review before sending
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-500 dark:text-purple-300 hover:text-gray-700 dark:hover:text-purple-100 transition-colors text-xl"
        >
          ✕
        </button>
      </div>

      <div className="bg-white/90 dark:bg-purple-800/30 rounded-xl p-6 mb-6 border border-orange-200 dark:border-purple-500/40 backdrop-blur-sm transition-all duration-300">
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-orange-200 dark:border-purple-500/40">
            <span className="text-sm font-bold text-orange-600 dark:text-purple-300">To:</span>
            <span className="text-sm text-gray-800 dark:text-purple-100 font-medium">{emailData.email}</span>
          </div>

          <div className="flex items-center gap-3 pb-3 border-b border-orange-200 dark:border-purple-500/40">
            <span className="text-sm font-bold text-orange-600 dark:text-purple-300">Subject:</span>
            <span className="text-sm text-gray-800 dark:text-purple-100 font-medium">
              Job Offer - {emailData.position} Position
            </span>
          </div>

          <div className="pt-4">
            <div className="bg-gradient-to-br from-orange-600 to-orange-500 dark:from-purple-600 dark:to-purple-500 text-white text-center py-7 rounded-t-xl">
              <h2 className="text-3xl font-bold">🎉 Job Offer</h2>
            </div>

            <div className="bg-orange-50/50 dark:bg-purple-900/20 p-6 space-y-4">
              <p className="text-gray-800 dark:text-purple-100 font-medium">
                Dear <strong>{emailData.name}</strong>,
              </p>

              <p className="text-gray-800 dark:text-purple-100">
                We are thrilled to extend a formal offer of employment for the position of{' '}
                <strong className="text-orange-700 dark:text-purple-300">{emailData.position}</strong> at our company!
              </p>

              <div className="bg-white/90 dark:bg-purple-800/40 rounded-xl p-5 border-2 border-orange-300 dark:border-purple-500/50">
                <h4 className="font-bold text-orange-700 dark:text-purple-200 mb-4 text-lg">📋 Offer Details</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-purple-200 font-medium">Position:</span>
                    <span className="font-bold text-gray-900 dark:text-purple-100">{emailData.position}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-purple-200 font-medium">Compensation:</span>
                    <span className="font-bold text-orange-600 dark:text-purple-300">{emailData.salary}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-purple-200 font-medium">Start Date:</span>
                    <span className="font-bold text-gray-900 dark:text-purple-100">As mutually agreed</span>
                  </div>
                </div>
              </div>

              <p className="text-gray-800 dark:text-purple-100">
                We believe you would be an excellent addition to our team and are excited about the contributions you will make.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex-1 bg-gradient-to-r from-orange-600 to-orange-500 dark:from-purple-600 dark:to-purple-500 hover:from-orange-700 hover:to-orange-600 dark:hover:from-purple-700 dark:hover:to-purple-600 text-white py-4 rounded-xl font-bold hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {sending ? (
            <div className="flex items-center justify-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
              <span>Sending...</span>
            </div>
          ) : (
            '✉️ Send Email'
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={sending}
          className="px-8 py-4 border-2 border-orange-300 dark:border-purple-500/50 text-orange-700 dark:text-purple-200 rounded-xl font-bold hover:bg-orange-100 dark:hover:bg-purple-800/40 transition-all duration-300 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}