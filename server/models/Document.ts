import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IDocument extends MongoDocument {
  filename: string;
  fileType: 'pdf' | 'csv';
  uploadDate: Date;
  sessionId?: string; // NEW: Track which chat session uploaded this
  chunks: Array<{
    content: string;
    embedding: number[];
    metadata: {
      pageNumber?: number;
      chunkIndex: number;
    };
  }>;
  extractedData?: {
    // PDF fields
    name?: string;
    email?: string;
    phone?: string;
    skills?: string[];
    rawText?: string;
    // CSV fields
    rowCount?: number;
    columns?: string[];
    parsedData?: Array<Record<string, unknown>>;
  };
}

const DocumentSchema = new Schema<IDocument>({
  filename: { type: String, required: true },
  fileType: { type: String, enum: ['pdf', 'csv'], required: true },
  uploadDate: { type: Date, default: Date.now },
  sessionId: { type: String, required: false }, // Index created separately for vector search compatibility
  chunks: [{
    content: String,
    embedding: [Number],
    metadata: {
      pageNumber: Number,
      chunkIndex: Number
    }
  }],
  extractedData: {
    // PDF fields
    name: String,
    email: String,
    phone: String,
    skills: [String],
    rawText: String,
    // CSV fields
    rowCount: Number,
    columns: [String],
    parsedData: [Schema.Types.Mixed]
  }
});

// Create index on sessionId for filtering (separate from vector index)
DocumentSchema.index({ sessionId: 1 });

// Note: Vector search index 'vector_index' must be created in MongoDB Atlas UI
// with path: chunks.embedding, dimensions: 1536, similarity: cosine

export default mongoose.models.Document || mongoose.model<IDocument>('Document', DocumentSchema);