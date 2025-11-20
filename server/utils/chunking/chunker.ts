import {
  Chunk,
  ChunkMetadata,
  ContentBlock,
  ChunkingConfig,
  DEFAULT_CONFIG,
} from "./types";
import { segmentIntoBlocks } from "./detectors";
import { preprocessText } from "./preprocessor";

/**
 * Creates chunks with overlap for context continuity
 */
function addOverlap(chunks: Chunk[], overlapSize: number): Chunk[] {
  if (chunks.length <= 1 || overlapSize === 0) {
    return chunks;
  }

  const chunksWithOverlap: Chunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let content = chunk.content;
    let hasOverlap = false;

    // Add overlap from previous chunk (last N characters)
    if (i > 0) {
      const prevChunk = chunks[i - 1];
      const overlapText = prevChunk.content.slice(-overlapSize);

      // Only add if it doesn't already start with similar text
      if (!content.startsWith(overlapText.slice(0, 50))) {
        content = overlapText + "\n\n" + content;
        hasOverlap = true;
      }
    }

    chunksWithOverlap.push({
      content,
      metadata: {
        ...chunk.metadata,
        hasOverlap,
      },
    });
  }

  return chunksWithOverlap;
}

/**
 * Chunks a single content block based on its type
 */
function chunkBlock(
  block: ContentBlock,
  chunkIndex: number,
  config: ChunkingConfig
): Chunk[] {
  const chunks: Chunk[] = [];

  // Determine max size based on content type
  const maxSize =
    block.type === "table" ? config.tableMaxSize : config.maxChunkSize;

  // If block fits in one chunk, return it as-is
  if (block.text.length <= maxSize) {
    chunks.push({
      content: block.text,
      metadata: {
        chunkIndex,
        pageNumber: undefined,
        contentType: block.type,
        confidence:
          block.confidence > 0.7
            ? "high"
            : block.confidence > 0.4
            ? "medium"
            : "low",
        hasOverlap: false,
        originalLength: block.text.length,
      },
    });
    return chunks;
  }

  // Block is too large - need to split it
  if (block.type === "table") {
    // For tables, try to split by rows
    return chunkTableByRows(block, chunkIndex, config);
  } else if (block.type === "list") {
    // For lists, split by list items
    return chunkListByItems(block, chunkIndex, config);
  } else {
    // For text and headings, split by sentences
    return chunkTextBySentences(block, chunkIndex, config);
  }
}

/**
 * Chunks a table by rows, trying to keep header with data
 */
function chunkTableByRows(
  block: ContentBlock,
  startIndex: number,
  config: ChunkingConfig
): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = block.text.split("\n");

  // Assume first line(s) might be headers
  const headerLines: string[] = [];
  const dataLines: string[] = [];

  // Simple heuristic: first 1-2 lines are headers if they look different
  if (lines.length > 0) {
    headerLines.push(lines[0]);
    if (
      (lines.length > 1 && lines[1].includes("-")) ||
      lines[1].includes("=")
    ) {
      headerLines.push(lines[1]); // Separator line
    }
  }

  // Rest are data
  for (let i = headerLines.length; i < lines.length; i++) {
    dataLines.push(lines[i]);
  }

  const header = headerLines.join("\n");
  let currentChunk = header;
  let currentIndex = startIndex;

  for (const line of dataLines) {
    const potentialChunk = currentChunk + "\n" + line;

    if (
      potentialChunk.length > config.tableMaxSize &&
      currentChunk !== header
    ) {
      // Save current chunk
      chunks.push({
        content: currentChunk,
        metadata: {
          chunkIndex: currentIndex++,
          contentType: "table",
          confidence: "high",
          hasOverlap: false,
          originalLength: currentChunk.length,
        },
      });

      // Start new chunk with header
      currentChunk = header + "\n" + line;
    } else {
      currentChunk = potentialChunk;
    }
  }

  // Add final chunk
  if (currentChunk.length > header.length) {
    chunks.push({
      content: currentChunk,
      metadata: {
        chunkIndex: currentIndex,
        contentType: "table",
        confidence: "high",
        hasOverlap: false,
        originalLength: currentChunk.length,
      },
    });
  }

  return chunks;
}

/**
 * Chunks a list by items
 */
function chunkListByItems(
  block: ContentBlock,
  startIndex: number,
  config: ChunkingConfig
): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = block.text.split("\n");

  let currentChunk = "";
  let currentIndex = startIndex;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const potentialChunk = currentChunk + (currentChunk ? "\n" : "") + line;

    if (
      potentialChunk.length > config.maxChunkSize &&
      currentChunk.length > 0
    ) {
      // Save current chunk
      chunks.push({
        content: currentChunk,
        metadata: {
          chunkIndex: currentIndex++,
          contentType: "list",
          confidence: "high",
          hasOverlap: false,
          originalLength: currentChunk.length,
        },
      });

      currentChunk = line;
    } else {
      currentChunk = potentialChunk;
    }
  }

  // Add final chunk
  if (currentChunk) {
    chunks.push({
      content: currentChunk,
      metadata: {
        chunkIndex: currentIndex,
        contentType: "list",
        confidence: "high",
        hasOverlap: false,
        originalLength: currentChunk.length,
      },
    });
  }

  return chunks;
}

/**
 * Chunks text by sentences
 */
function chunkTextBySentences(
  block: ContentBlock,
  startIndex: number,
  config: ChunkingConfig
): Chunk[] {
  const chunks: Chunk[] = [];

  // Split by sentence boundaries
  const sentences = block.text.match(/[^.!?]+[.!?]+/g) || [block.text];

  let currentChunk = "";
  let currentIndex = startIndex;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const potentialChunk = currentChunk + (currentChunk ? " " : "") + trimmed;

    if (
      potentialChunk.length > config.maxChunkSize &&
      currentChunk.length >= config.minChunkSize
    ) {
      // Save current chunk
      chunks.push({
        content: currentChunk,
        metadata: {
          chunkIndex: currentIndex++,
          contentType: block.type,
          confidence: block.confidence > 0.7 ? "high" : "medium",
          hasOverlap: false,
          originalLength: currentChunk.length,
        },
      });

      currentChunk = trimmed;
    } else {
      currentChunk = potentialChunk;
    }
  }

  // Add final chunk
  if (currentChunk && currentChunk.length >= config.minChunkSize) {
    chunks.push({
      content: currentChunk,
      metadata: {
        chunkIndex: currentIndex,
        contentType: block.type,
        confidence: block.confidence > 0.7 ? "high" : "medium",
        hasOverlap: false,
        originalLength: currentChunk.length,
      },
    });
  } else if (currentChunk && chunks.length > 0) {
    // If final chunk is too small, append to previous chunk
    const lastChunk = chunks[chunks.length - 1];
    lastChunk.content += " " + currentChunk;
    lastChunk.metadata.originalLength = lastChunk.content.length;
  } else if (currentChunk) {
    // No previous chunks, keep the small chunk anyway
    chunks.push({
      content: currentChunk,
      metadata: {
        chunkIndex: currentIndex,
        contentType: block.type,
        confidence: "low",
        hasOverlap: false,
        originalLength: currentChunk.length,
      },
    });
  }

  return chunks;
}

/**
 * Main semantic chunking function
 * This is the entry point for all chunking operations
 */
export function semanticChunk(
  text: string,
  pageNumber?: number,
  config: ChunkingConfig = DEFAULT_CONFIG
): Chunk[] {
  // Step 1: Preprocess the text
  const cleanedText = preprocessText(text, {
    removeRepeated: true,
    removePageNumbers: true,
    fixOCR: false, // Set to true if dealing with scanned PDFs
    removeLinks: false, // Keep links in content
  });

  // Step 2: Segment into content blocks
  const blocks = segmentIntoBlocks(cleanedText);

  if (blocks.length === 0) {
    return [];
  }

  // Step 3: Chunk each block based on its type
  const allChunks: Chunk[] = [];
  let chunkIndex = 0;

  for (const block of blocks) {
    const blockChunks = chunkBlock(block, chunkIndex, config);

    // Add page number to metadata if provided
    if (pageNumber !== undefined) {
      blockChunks.forEach((chunk) => {
        chunk.metadata.pageNumber = pageNumber;
      });
    }

    allChunks.push(...blockChunks);
    chunkIndex += blockChunks.length;
  }

  // Step 4: Add overlap between chunks for context continuity
  const chunksWithOverlap = addOverlap(allChunks, config.overlapSize);

  // Step 5: Filter out very small chunks (noise)
  const finalChunks = chunksWithOverlap.filter(
    (chunk) => chunk.content.trim().length >= config.minChunkSize
  );

  return finalChunks;
}

/**
 * Batch chunking for multiple pages
 * Useful when processing multi-page PDFs
 */
export function semanticChunkMultiPage(
  pages: Array<{ text: string; pageNumber: number }>,
  config: ChunkingConfig = DEFAULT_CONFIG
): Chunk[] {
  const allChunks: Chunk[] = [];

  for (const page of pages) {
    const pageChunks = semanticChunk(page.text, page.pageNumber, config);
    allChunks.push(...pageChunks);
  }

  // Recalculate chunk indices to be sequential across all pages
  allChunks.forEach((chunk, index) => {
    chunk.metadata.chunkIndex = index;
  });

  return allChunks;
}

/**
 * Get chunking statistics for analysis
 */
export function getChunkingStats(chunks: Chunk[]): {
  totalChunks: number;
  avgChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  contentTypes: Record<string, number>;
  confidenceLevels: Record<string, number>;
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      avgChunkSize: 0,
      minChunkSize: 0,
      maxChunkSize: 0,
      contentTypes: {},
      confidenceLevels: {},
    };
  }

  const sizes = chunks.map((c) => c.content.length);
  const contentTypes: Record<string, number> = {};
  const confidenceLevels: Record<string, number> = {};

  chunks.forEach((chunk) => {
    contentTypes[chunk.metadata.contentType] =
      (contentTypes[chunk.metadata.contentType] || 0) + 1;
    confidenceLevels[chunk.metadata.confidence] =
      (confidenceLevels[chunk.metadata.confidence] || 0) + 1;
  });

  return {
    totalChunks: chunks.length,
    avgChunkSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
    minChunkSize: Math.min(...sizes),
    maxChunkSize: Math.max(...sizes),
    contentTypes,
    confidenceLevels,
  };
}
