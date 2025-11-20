import fs from "fs";
import { parse } from "csv-parse/sync";
import Document from "../models/Document";
import { semanticChunk, extractContactInfo } from "../utils/chunking";
import { generateEmbeddings } from "./vector.service";
import connectDB from "../config/db";

const pdfParse = require("pdf-parse");

export async function processPDF(filePath: string, filename: string, sessionId: string) {
  await connectDB();

  try {
    console.log(`📄 Processing PDF: ${filename} for session: ${sessionId}`);
    console.log(`📂 File path: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    console.log(`✅ Extracted ${data.text.length} characters from PDF`);

    // Check if text was extracted
    if (!data.text || data.text.trim().length === 0) {
      throw new Error("NO_TEXT_EXTRACTED: PDF appears to be empty or contains only images");
    }

    const extractedData = extractContactInfo(data.text);
    console.log("✅ Extracted contact info:", extractedData);

    console.log("🔄 Performing semantic chunking...");
    const chunks = semanticChunk(data.text, 1);
    console.log(`✅ Chunked into ${chunks.length} semantic chunks`);

    // Check if chunks were created
    if (chunks.length === 0) {
      throw new Error("NO_TEXT_EXTRACTED: Could not create meaningful chunks from PDF content");
    }

    console.log("🔄 Generating embeddings...");
    const embeddings = await generateEmbeddings(
      chunks.map((c: any) => c.content)
    );
    console.log("✅ Embeddings generated");

    const chunksWithEmbeddings = chunks.map((chunk: any, i: number) => ({
      content: chunk.content,
      embedding: embeddings[i],
      metadata: chunk.metadata,
    }));

    const document = await Document.create({
      filename,
      fileType: "pdf",
      sessionId,
      chunks: chunksWithEmbeddings,
      extractedData: {
        ...extractedData,
        rawText: data.text,
      },
    });

    console.log("✅ Saved to database");
    console.log(`   Document ID: ${document._id}`);
    console.log(`   Session ID: ${document.sessionId}`);

    try {
      fs.unlinkSync(filePath);
      console.log("✅ Cleaned up temporary file");
    } catch (cleanupError) {
      console.warn("⚠️ Could not delete temp file:", cleanupError);
    }

    console.log(`✅ PDF processed successfully. Document ID: ${document._id}`);
    return document;
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string; errorType?: string };
    console.error("❌ Error processing PDF:", err);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.warn("⚠️ Could not delete temp file on error:", cleanupError);
      }
    }

    // Add error type identification to help with proper error messages
    if (err.name === 'MongoServerError' || err.message?.includes('Mongo')) {
      (err as { errorType: string }).errorType = 'DATABASE';
    } else if (err.message?.includes('NO_TEXT_EXTRACTED')) {
      (err as { errorType: string }).errorType = 'NO_TEXT';
    } else if (err.message?.includes('OPENAI') || err.message?.includes('OpenAI')) {
      (err as { errorType: string }).errorType = 'OPENAI_API';
    }

    throw err;
  }
}

export async function processCSV(filePath: string, filename: string, sessionId: string) {
  await connectDB();

  try {
    console.log(`📊 Processing CSV: ${filename} for session: ${sessionId}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    
    // Detect delimiter (comma or tab)
    const delimiter = fileContent.includes('\t') && !fileContent.includes(',') ? '\t' : ',';
    console.log(`📊 Using delimiter: ${delimiter === '\t' ? 'tab' : 'comma'}`);
    
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: delimiter,
      relax_quotes: true,
      trim: true,
    });

    console.log(`✅ Parsed ${records.length} rows from CSV`);

    const textRepresentation = records
      .map((row: any) =>
        Object.entries(row)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ")
      )
      .join("\n");

    console.log("🔄 Performing semantic chunking...");
    const chunks = semanticChunk(textRepresentation, 1);
    console.log(`✅ Chunked into ${chunks.length} semantic chunks`);

    console.log("🔄 Generating embeddings...");
    const embeddings = await generateEmbeddings(
      chunks.map((c: any) => c.content)
    );
    console.log("✅ Embeddings generated");

    const chunksWithEmbeddings = chunks.map((chunk: any, i: number) => ({
      content: chunk.content,
      embedding: embeddings[i],
      metadata: chunk.metadata,
    }));

    const document = await Document.create({
      filename,
      fileType: "csv",
      sessionId,
      chunks: chunksWithEmbeddings,
      extractedData: {
        rowCount: records.length,
        columns: Object.keys(records[0] || {}),
        rawText: textRepresentation,
        parsedData: records, // Add the actual parsed CSV data
      },
    });

    console.log("✅ Saved to database");
    console.log(`   Document ID: ${document._id}`);
    console.log(`   Session ID: ${document.sessionId}`);

    try {
      fs.unlinkSync(filePath);
      console.log("✅ Cleaned up temporary file");
    } catch (cleanupError) {
      console.warn("⚠️ Could not delete temp file:", cleanupError);
    }

    console.log(`✅ CSV processed successfully. Document ID: ${document._id}`);
    return document;
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string; errorType?: string };
    console.error("❌ Error processing CSV:", err);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.warn("⚠️ Could not delete temp file on error:", cleanupError);
      }
    }

    // Add error type identification to help with proper error messages
    if (err.name === 'MongoServerError' || err.message?.includes('Mongo')) {
      (err as { errorType: string }).errorType = 'DATABASE';
    } else if (err.message?.includes('OPENAI') || err.message?.includes('OpenAI')) {
      (err as { errorType: string }).errorType = 'OPENAI_API';
    }

    throw err;
  }
}
