/**
 * User-friendly error messages
 * Provides helpful, actionable error messages instead of technical jargon
 */

export const ErrorMessages = {
  // Upload errors
  NO_FILE: {
    message: "No file was uploaded. Please select a PDF or CSV file to continue.",
    suggestion: "Drag and drop a file or click to browse your computer.",
  },
  
  UNSUPPORTED_FILE: {
    message: "This file type is not supported.",
    suggestion: "Please upload a PDF document or CSV file. Other formats are not yet supported.",
  },
  
  FILE_TOO_LARGE: {
    message: "File size exceeds the 10MB limit.",
    suggestion: "Try compressing your file or uploading a smaller document.",
  },
  
  FILE_CORRUPTED: {
    message: "Unable to read this file. It may be corrupted or protected.",
    suggestion: "Make sure the file is not password-protected and try a different file.",
  },

  // Processing errors
  PDF_PARSE_FAILED: {
    message: "Could not extract text from this PDF.",
    suggestion: "The PDF might be scanned images. Try using a text-based PDF or converting it first.",
  },
  
  CSV_PARSE_FAILED: {
    message: "Could not parse this CSV file.",
    suggestion: "Make sure the file has proper comma-separated values and check for formatting issues.",
  },
  
  NO_TEXT_EXTRACTED: {
    message: "No readable text found in this document.",
    suggestion: "The document appears to be empty or contains only images. Try a different file.",
  },

  // Database errors
  DB_CONNECTION_FAILED: {
    message: "Could not connect to the database.",
    suggestion: "Please try again in a moment. If the problem persists, contact support.",
  },
  
  VECTOR_SEARCH_FAILED: {
    message: "Search functionality is temporarily unavailable.",
    suggestion: "Please refresh the page and try again.",
  },

  // API errors
  OPENAI_API_ERROR: {
    message: "AI service is temporarily unavailable.",
    suggestion: "Please try again in a moment. The AI service may be experiencing high demand.",
  },
  
  RATE_LIMIT_EXCEEDED: {
    message: "Too many requests. Please slow down.",
    suggestion: "Wait a few seconds before making another request.",
  },

  // Email errors
  EMAIL_MISSING_DATA: {
    message: "Could not find recipient information in the resume.",
    suggestion: "Make sure the resume includes a name and email address.",
  },
  
  EMAIL_SEND_FAILED: {
    message: "Failed to send the email.",
    suggestion: "Check your email configuration or try again later.",
  },

  // Chat errors
  NO_DOCUMENTS: {
    message: "No documents uploaded yet.",
    suggestion: "Upload a PDF resume or CSV file to get started!",
  },
  
  EMPTY_MESSAGE: {
    message: "Please enter a message.",
    suggestion: "Type a question about your uploaded document.",
  },

  // Generic
  UNEXPECTED_ERROR: {
    message: "Something unexpected happened.",
    suggestion: "Please refresh the page and try again. If the issue persists, contact support.",
  },
};

export type ErrorCode = keyof typeof ErrorMessages;

export function getUserFriendlyError(
  code: ErrorCode,
  technicalDetails?: string
): { message: string; suggestion: string; technical?: string } {
  const error = ErrorMessages[code];
  
  return {
    message: error.message,
    suggestion: error.suggestion,
    ...(process.env.NODE_ENV === 'development' && technicalDetails && {
      technical: technicalDetails,
    }),
  };
}
