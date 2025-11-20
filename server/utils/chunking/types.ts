export interface ChunkMetadata {
  chunkIndex: number;
  pageNumber?: number;
  contentType: "text" | "table" | "list" | "heading";
  confidence: "high" | "medium" | "low";
  hasOverlap: boolean;
  originalLength: number;
}

export interface Chunk {
  content: string;
  metadata: ChunkMetadata;
}

export interface ContentBlock {
  text: string;
  type: "text" | "table" | "list" | "heading";
  confidence: number;
  startLine: number;
  endLine: number;
}

export interface ChunkingConfig {
  maxChunkSize: number;
  overlapSize: number;
  tableMaxSize: number;
  minChunkSize: number;
}

export const DEFAULT_CONFIG: ChunkingConfig = {
  maxChunkSize: 1000,
  overlapSize: 200,
  tableMaxSize: 2000,
  minChunkSize: 100,
};
