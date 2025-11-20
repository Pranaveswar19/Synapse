export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/ +/g, " ")
    .replace(/\t+/g, "\t")
    .replace(/\n{4,}/g, "\n\n\n");
}

export function removePDFArtifacts(text: string): string {
  let cleaned = text;

  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, "");
  cleaned = cleaned.replace(/\u00AD/g, "");

  cleaned = cleaned
    .replace(/(\w)-\s+(\w)/g, "$1$2")
    .replace(/([a-z])([A-Z])/g, "$1 $2");

  cleaned = cleaned.replace(/\f/g, "\n\n");

  return cleaned;
}

export function removeRepeatedSections(text: string): string {
  const lines = text.split("\n");
  const lineFrequency = new Map<string, number>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 5 && trimmed.length < 100) {
      lineFrequency.set(trimmed, (lineFrequency.get(trimmed) || 0) + 1);
    }
  }

  const repeatedLines = new Set<string>();
  for (const [line, count] of lineFrequency.entries()) {
    if (count > 2) {
      repeatedLines.add(line);
    }
  }

  if (repeatedLines.size > 0) {
    return lines.filter((line) => !repeatedLines.has(line.trim())).join("\n");
  }

  return text;
}

export function normalizeLists(text: string): string {
  return text
    .replace(/^[\s]*[•●○◦▪▫■□★☆►▸]+[\s]+/gm, "• ")
    .replace(/^[\s]*[-–—]+[\s]+/gm, "• ")
    .replace(/^[\s]*(\d+)[\.)]\s+/gm, "$1. ");
}

export function removePageNumbers(text: string): string {
  const lines = text.split("\n");

  return lines
    .filter((line) => {
      const trimmed = line.trim();

      if (/^(page\s+)?\d+(\s*(\/|of)\s*\d+)?$/i.test(trimmed)) {
        return false;
      }

      if (/^\d{1,3}$/.test(trimmed)) {
        return false;
      }

      return true;
    })
    .join("\n");
}

export function removeStandaloneLinks(text: string): string {
  const lines = text.split("\n");

  return lines
    .filter((line) => {
      const trimmed = line.trim();

      if (/^https?:\/\/[^\s]+$/.test(trimmed)) {
        return false;
      }

      if (/^[\w.-]+@[\w.-]+\.\w+$/.test(trimmed)) {
        return false;
      }

      return true;
    })
    .join("\n");
}

export function fixOCRErrors(text: string): string {
  return text
    .replace(/\bl\b/g, "I")
    .replace(/\b0\b/g, "O")
    .replace(/([a-z])1([a-z])/g, "$1l$2")
    .replace(/(\w)1\s/g, "$1l ")
    .replace(/\s1(\w)/g, " l$1");
}

export function preserveFormatting(text: string): string {
  return text;
}

export function preprocessText(
  text: string,
  options: {
    removeRepeated?: boolean;
    removePageNumbers?: boolean;
    fixOCR?: boolean;
    removeLinks?: boolean;
  } = {}
): string {
  let processed = text;

  processed = normalizeWhitespace(processed);
  processed = removePDFArtifacts(processed);

  if (options.removePageNumbers !== false) {
    processed = removePageNumbers(processed);
  }

  if (options.removeLinks !== false) {
    processed = removeStandaloneLinks(processed);
  }

  if (options.removeRepeated !== false) {
    processed = removeRepeatedSections(processed);
  }

  processed = normalizeLists(processed);

  if (options.fixOCR === true) {
    processed = fixOCRErrors(processed);
  }

  processed = normalizeWhitespace(processed);

  return processed.trim();
}

export function quickClean(text: string): string {
  return normalizeWhitespace(removePDFArtifacts(text));
}
