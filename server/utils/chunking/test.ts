import { semanticChunk, getChunkingStats } from "./index";

// Test data
const testResume = `
John Doe
john.doe@email.com
(555) 123-4567

Professional Experience

Software Engineer
Tech Company Inc.
2020 - Present

Developed and maintained multiple production applications using Python, JavaScript, and React. Led a team of 5 engineers on key projects.

Key Achievements:
1. Reduced API latency by 40%
2. Implemented CI/CD pipeline
3. Mentored junior developers

Skills

Programming Languages:
Python    JavaScript    TypeScript    Java
React     Node.js       Express       MongoDB

Project Details:
Project Name    Duration    Technologies
Project A       6 months    Python, FastAPI, PostgreSQL
Project B       1 year      React, Node.js, MongoDB
Project C       3 months    TypeScript, GraphQL, Redis

Education

B.S. Computer Science
University of Technology
2016 - 2020

Page 1
`.trim();

console.log("🧪 Testing Semantic Chunking System\n");
console.log("=".repeat(60));

// Run chunking
const chunks = semanticChunk(testResume, 1);

console.log("\n📊 Chunking Results:\n");

chunks.forEach((chunk, i) => {
  console.log(`\n--- Chunk ${i + 1} ---`);
  console.log(`Type: ${chunk.metadata.contentType}`);
  console.log(`Confidence: ${chunk.metadata.confidence}`);
  console.log(`Length: ${chunk.content.length} chars`);
  console.log(`Has Overlap: ${chunk.metadata.hasOverlap}`);
  console.log(`Content Preview: ${chunk.content.slice(0, 100)}...`);
});

// Show statistics
console.log("\n\n📈 Statistics:\n");
const stats = getChunkingStats(chunks);
console.log(JSON.stringify(stats, null, 2));

console.log("\n\n✅ Test complete!");
