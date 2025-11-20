'use client';

import { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import FileUpload from './components/FileUpload';

export default function Home() {
  const [uploadedDoc, setUploadedDoc] = useState<any>(null);

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-orange-100/50 to-amber-50 dark:from-gray-950 dark:via-purple-950 dark:to-violet-950 py-12 px-4 transition-all duration-500">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 dark:from-purple-400 dark:to-purple-300 bg-clip-text text-transparent transition-all duration-500">
              Synapse
            </h1>
            <p className="text-lg text-gray-700 dark:text-purple-200 font-medium transition-colors duration-500">
              Agentic Knowledge Workspace
            </p>
          </div>

          {!uploadedDoc ? (
            <FileUpload onUploadSuccess={setUploadedDoc} />
          ) : (
            <div className="space-y-6">
              <div className="bg-white/95 dark:bg-purple-900/50 backdrop-blur-md rounded-2xl shadow-lg dark:shadow-purple-500/20 border border-orange-200/50 dark:border-purple-500/30 p-6 transition-all duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600 dark:text-purple-300 font-semibold">Uploaded Document</p>
                    <p className="font-semibold text-gray-900 dark:text-white mt-1">{uploadedDoc.filename}</p>
                    {uploadedDoc.extractedData?.name && (
                      <p className="text-sm text-orange-500 dark:text-purple-400 mt-2">
                        Candidate: {uploadedDoc.extractedData.name} • {uploadedDoc.extractedData.email}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setUploadedDoc(null)}
                    className="px-4 py-2 text-sm font-medium text-orange-700 dark:text-purple-300 hover:text-orange-900 dark:hover:text-purple-100 hover:bg-orange-100 dark:hover:bg-purple-800/50 rounded-lg transition-all duration-300"
                  >
                    Upload New
                  </button>
                </div>
              </div>

              <ChatInterface />
            </div>
          )}
        </div>
      </main>
  );
}