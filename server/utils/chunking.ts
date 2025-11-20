import {
  semanticChunk as newSemanticChunk,
  DEFAULT_CONFIG,
} from "./chunking/index";

export interface Chunk {
  content: string;
  metadata: {
    pageNumber?: number;
    chunkIndex: number;
  };
}

export function semanticChunk(text: string, pageNumber?: number): Chunk[] {
  const newChunks = newSemanticChunk(text, pageNumber, DEFAULT_CONFIG);

  return newChunks.map((chunk) => ({
    content: chunk.content,
    metadata: {
      pageNumber: chunk.metadata.pageNumber,
      chunkIndex: chunk.metadata.chunkIndex,
    },
  }));
}

export function extractContactInfo(text: string) {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);

  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const nameMatch = lines[0]?.match(/^[A-Z][a-z]+ [A-Z][a-z]+/);

  const skillsMatch = text.match(/Skills?:?\s*\n?(.*?)(?=\n\n|$)/i);
  let skills: string[] = [];
  if (skillsMatch) {
    skills = skillsMatch[1]
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 50);
  }

  return {
    name: nameMatch ? nameMatch[0] : null,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
    skills,
  };
}
