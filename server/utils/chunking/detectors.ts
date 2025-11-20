import { ContentBlock } from "./types";

export function detectTable(text: string): {
  isTable: boolean;
  confidence: number;
} {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { isTable: false, confidence: 0 };
  }

  let score = 0;
  let maxScore = 0;

  const pipeLines = lines.filter((l) => l.includes("|")).length;
  if (pipeLines >= 3) {
    score += 30;
    if (pipeLines / lines.length > 0.7) score += 20;
  }
  maxScore += 50;

  const tabLines = lines.filter((l) => l.includes("\t")).length;
  if (tabLines >= 3) {
    score += 20;
  }
  maxScore += 20;

  const spacedLines = lines.filter((l) => /\s{3,}/.test(l)).length;
  if (spacedLines >= 3) {
    score += 15;
    if (spacedLines / lines.length > 0.6) score += 10;
  }
  maxScore += 25;

  const avgLength = lines.reduce((sum, l) => sum + l.length, 0) / lines.length;
  const variance =
    lines.reduce((sum, l) => sum + Math.abs(l.length - avgLength), 0) /
    lines.length;
  if (variance < avgLength * 0.3) {
    score += 15;
  }
  maxScore += 15;

  const numericLines = lines.filter((l) => /\d+/.test(l)).length;
  if (numericLines / lines.length > 0.5) {
    score += 10;
  }
  maxScore += 10;

  const confidence = score / maxScore;
  const isTable = confidence > 0.4;

  return { isTable, confidence };
}

export function detectList(text: string): {
  isList: boolean;
  confidence: number;
} {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { isList: false, confidence: 0 };
  }

  let score = 0;
  let maxScore = 0;

  const numberedPattern = /^\s*\d+[\.)]\s+/;
  const numberedLines = lines.filter((l) => numberedPattern.test(l)).length;
  if (numberedLines >= 2) {
    score += 40;
    if (numberedLines / lines.length > 0.7) score += 20;
  }
  maxScore += 60;

  const bulletPattern = /^\s*[•\-*○►▪]\s+/;
  const bulletLines = lines.filter((l) => bulletPattern.test(l)).length;
  if (bulletLines >= 2) {
    score += 30;
    if (bulletLines / lines.length > 0.7) score += 15;
  }
  maxScore += 45;

  const indentedLines = lines.filter((l) => /^\s{2,}/.test(l)).length;
  if (indentedLines / lines.length > 0.5) {
    score += 10;
  }
  maxScore += 10;

  const confidence = score / maxScore;
  const isList = confidence > 0.35;

  return { isList, confidence };
}

export function detectHeading(text: string): {
  isHeading: boolean;
  confidence: number;
} {
  const trimmed = text.trim();
  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length !== 1) {
    return { isHeading: false, confidence: 0 };
  }

  const line = lines[0];
  let score = 0;
  let maxScore = 0;

  if (line.length < 60) {
    score += 20;
    if (line.length < 40) score += 10;
  }
  maxScore += 30;

  const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);
  const isTitleCase = /^[A-Z][a-z]/.test(line);
  if (isAllCaps) {
    score += 30;
  } else if (isTitleCase) {
    score += 20;
  }
  maxScore += 30;

  if (!/[.!?]$/.test(line)) {
    score += 15;
  }
  maxScore += 15;

  const headingKeywords =
    /^(summary|skills|experience|education|projects|certifications|about|overview|background|qualifications)/i;
  if (headingKeywords.test(line)) {
    score += 25;
  }
  maxScore += 25;

  if (/^[#*]{1,3}\s/.test(line) || /\*\*/.test(line)) {
    score += 20;
  }
  maxScore += 20;

  const confidence = score / maxScore;
  const isHeading = confidence > 0.4;

  return { isHeading, confidence };
}

export function detectHeaderFooter(text: string): boolean {
  const trimmed = text.trim();

  if (/^(page\s+)?\d+(\s*\/\s*\d+)?$/i.test(trimmed)) {
    return true;
  }

  if (trimmed.length < 30 && trimmed.length > 0) {
    const commonPatterns =
      /^(confidential|draft|proprietary|copyright|©|\d{4})/i;
    if (commonPatterns.test(trimmed)) {
      return true;
    }
  }

  if (/^(https?:\/\/|www\.|[\w.-]+@[\w.-]+\.\w+)$/i.test(trimmed)) {
    return true;
  }

  return false;
}

export function analyzeContentBlock(
  text: string,
  startLine: number,
  endLine: number
): ContentBlock {
  if (detectHeaderFooter(text)) {
    return {
      text,
      type: "text",
      confidence: 0,
      startLine,
      endLine,
    };
  }

  const headingResult = detectHeading(text);
  if (headingResult.isHeading) {
    return {
      text,
      type: "heading",
      confidence: headingResult.confidence,
      startLine,
      endLine,
    };
  }

  const tableResult = detectTable(text);
  if (tableResult.isTable) {
    return {
      text,
      type: "table",
      confidence: tableResult.confidence,
      startLine,
      endLine,
    };
  }

  const listResult = detectList(text);
  if (listResult.isList) {
    return {
      text,
      type: "list",
      confidence: listResult.confidence,
      startLine,
      endLine,
    };
  }

  return {
    text,
    type: "text",
    confidence: 1.0,
    startLine,
    endLine,
  };
}

export function segmentIntoBlocks(text: string): ContentBlock[] {
  const paragraphs = text.split(/\n\n+/);
  const blocks: ContentBlock[] = [];
  let lineNumber = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n").length;
    const block = analyzeContentBlock(
      trimmed,
      lineNumber,
      lineNumber + lines - 1
    );

    if (block.confidence > 0) {
      blocks.push(block);
    }

    lineNumber += lines + 2;
  }

  return blocks;
}
