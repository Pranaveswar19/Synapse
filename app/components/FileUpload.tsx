'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSessionId } from '../hooks/useSessionId';

interface ErrorState {
  message: string;
  suggestion?: string;
}

export default function FileUpload({ onUploadSuccess }: { onUploadSuccess: (data: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const { sessionId } = useSessionId();

  const handleFile = async (file: File) => {
    if (!file) return;

    if (!sessionId) {
      setError({
        message: 'Session not initialized',
        suggestion: 'Please refresh the page and try again.',
      });
      return;
    }

    // Clear previous errors
    setError(null);

    // Client-side validation
    const validTypes = ['application/pdf', 'text/csv'];
    if (!validTypes.includes(file.type)) {
      setError({
        message: 'This file type is not supported.',
        suggestion: 'Please upload a PDF document or CSV file.',
      });
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError({
        message: 'File size exceeds the 10MB limit.',
        suggestion: 'Try compressing your file or uploading a smaller document.',
      });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);

    try {
      const res = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      
      if (data.success) {
        onUploadSuccess(data);
      } else {
        setError({
          message: data.error || 'Upload failed',
          suggestion: data.suggestion,
        });
      }
    } catch (error: any) {
      setError({
        message: 'Could not connect to the server.',
        suggestion: 'Please check your internet connection and try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto space-y-4"
    >
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
          dragActive
            ? 'border-orange-500 dark:border-purple-500 bg-orange-50 dark:bg-purple-900/30 scale-105'
            : error
            ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/30'
            : 'border-orange-300 dark:border-purple-500/50 bg-white/90 dark:bg-purple-800/30 hover:border-orange-400 dark:hover:border-purple-400'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.csv"
          onChange={handleChange}
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        
        {uploading ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-14 w-14 border-b-3 border-orange-600 dark:border-purple-400 mx-auto"></div>
            <p className="text-gray-700 dark:text-purple-100 font-semibold text-lg">Processing file...</p>
            <p className="text-sm text-gray-600 dark:text-purple-200">This may take a few moments</p>
          </div>
        ) : (
          <div className="space-y-5">
            <svg className="mx-auto h-16 w-16 text-orange-500 dark:text-purple-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-gray-700 dark:text-purple-100">
              <p className="text-xl font-semibold">Drop your file here or click to browse</p>
              <p className="text-sm text-gray-600 dark:text-purple-200 mt-2 font-medium">PDF or CSV files only • Max 10MB</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-500/50 rounded-xl p-5 backdrop-blur-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">
                  {error.message}
                </h3>
                {error.suggestion && (
                  <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                    {error.suggestion}
                  </p>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className="flex-shrink-0 text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}