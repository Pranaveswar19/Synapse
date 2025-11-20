import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { StateGraph, Annotation } from "@langchain/langgraph";
import { generateEmbedding } from "../services/vector.service";
import Document from "../models/Document";
import connectDB from "../config/db";
import { detectChartRequest, prepareChartData } from "./chart.service";

interface ExtractedData {
  name?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  rawText?: string;
  parsedData?: Array<Record<string, unknown>>; // For CSV files
  rowCount?: number;
  columns?: string[];
  [key: string]: unknown;
}

interface DocumentType {
  _id: string;
  filename: string;
  fileType: string;
  extractedData?: ExtractedData;
  chunks?: Array<{
    content: string;
    embedding: number[];
    metadata: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

// Lazy initialization of models to ensure env vars are loaded
let model: ChatOpenAI | null = null;
let thinkingModel: ChatOpenAI | null = null;

function getModel(): ChatOpenAI {
  if (!model) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.7,
      streaming: false,
    });
  }
  return model;
}

function getThinkingModel(): ChatOpenAI {
  if (!thinkingModel) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    thinkingModel = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.3,
      streaming: false,
    });
  }
  return thinkingModel;
}

interface StreamEvent {
  type: "thinking" | "response" | "done" | "error" | "chart" | "email_preview";
  content?: string;
  step?: string;
}

type StreamCallback = (event: StreamEvent) => void;

// Generate real-time thinking explanation using GPT
async function generateThinking(
  action: string,
  context: Record<string, any>
): Promise<string> {
  const prompt = `You are explaining your AI reasoning process to a user in real-time. Generate a concise, transparent thinking message (one sentence, max 100 chars).

Action: ${action}
Context: ${JSON.stringify(context)}

Be specific about what you're doing and why. Use emojis. Be transparent about AI decisions.

Examples:
- "🔍 Comparing your query against 1000 CSV rows using vector similarity"
- "🧠 GPT analyzing if this needs an email (detected: offer letter request)"
- "📊 Found 'top 20' - loading all 1000 CSV rows to find the top performers"

Your thinking message:`;

  try {
    const response = await getThinkingModel().invoke([new HumanMessage(prompt)]);
    return response.content.toString().trim();
  } catch (error) {
    // Fallback to simple message if GPT fails
    return action;
  }
}

const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<Array<{ role: string; content: string }>>({
    reducer: (state, update) => [...state, ...update],
    default: () => [],
  }),
  thinking: Annotation<string[]>({
    reducer: (state) => state,
    default: () => [],
  }),
  documents: Annotation<DocumentType[]>({
    reducer: (state, update) => update,
    default: () => [],
  }),
  vectorResults: Annotation<DocumentType[]>({
    reducer: (state, update) => update,
    default: () => [],
  }),
  shouldEmail: Annotation<boolean>({
    reducer: (state, update) => update,
    default: () => false,
  }),
  emailData: Annotation<{ name: string; email: string; position: string; salary: string } | null>({
    reducer: (state, update) => update,
    default: () => null,
  }),
  finalResponse: Annotation<string>({
    reducer: (state, update) => update,
    default: () => "",
  }),
});

type AgentState = typeof AgentStateAnnotation.State;

async function analyzeIntent(
  state: AgentState,
  streamCallback: StreamCallback
): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1].content;

  const thinking = await generateThinking("Analyzing user intent", {
    query: lastMessage.substring(0, 50),
  });
  streamCallback({ type: "thinking", step: thinking });

  const prompt = `Analyze if this request EXPLICITLY requires sending an offer letter email: "${lastMessage}"

ONLY return true if the message CLEARLY requests:
- Sending an offer letter
- Drafting an offer email
- Emailing the candidate with a job offer
- Making a formal offer

DO NOT return true for:
- General questions about the candidate
- Asking if candidate is good/qualified
- Comparison requests
- Information retrieval
- Chart or data visualization requests

Respond with JSON only:
{
  "requiresEmail": boolean,
  "reasoning": "brief explanation of your decision"
}`;

  const response = await getModel().invoke([new HumanMessage(prompt)]);
  let content = response.content as string;
  content = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const analysis = JSON.parse(content);

  // Show the actual GPT reasoning
  streamCallback({ type: "thinking", step: `💭 ${analysis.reasoning}` });

  return {
    shouldEmail: analysis.requiresEmail,
  };
}

function detectAggregationQuery(message: string): boolean {
  const aggregationKeywords = [
    "how many",
    "count",
    "total",
    "sum",
    "average",
    "mean",
    "all employees",
    "list all",
    "show all",
    "all the",
    "number of",
    "total number",
    "how much",
    "aggregate",
    "tally",
    "top ",
    "top 5",
    "top 10",
    "top 20",
    "bottom ",
    "least ",
    "highest ",
    "lowest ",
    "best ",
    "worst ",
  ];

  const lowerMessage = message.toLowerCase();
  const isAggregation = aggregationKeywords.some((keyword) =>
    lowerMessage.includes(keyword)
  );

  console.log("🔍 Aggregation detection:");
  console.log("  Message:", message);
  console.log("  Is Aggregation:", isAggregation);

  return isAggregation;
}

async function retrieveContext(
  state: AgentState,
  streamCallback: StreamCallback,
  sessionId?: string
): Promise<Partial<AgentState>> {
  await connectDB();

  const thinking1 = await generateThinking("Connecting to database", {});
  streamCallback({ type: "thinking", step: thinking1 });

  // SESSION-BASED FILTERING: Only get documents from THIS session
  // IMPORTANT: Documents without sessionId are from old system - ignore them
  console.log(`🔍 Querying documents with sessionId: ${sessionId}`);
  
  if (!sessionId) {
    // No session ID provided - this is an error state
    streamCallback({
      type: "thinking",
      step: "⚠️ No session ID - please refresh the page",
    });
    return {
      thinking: ["No session ID"],
      finalResponse: "Session error. Please refresh the page and try again.",
      documents: [],
      vectorResults: [],
    };
  }
  
  // Only get documents with matching sessionId (excludes null/undefined sessionIds)
  const documents = await Document.find({ sessionId }).sort({ uploadDate: -1 });
  
  const allDocsCount = await Document.countDocuments();
  const legacyDocsCount = await Document.countDocuments({ sessionId: { $exists: false } });
  
  console.log(`📊 Found ${documents.length} documents for session ${sessionId}`);
  console.log(`📊 Total documents in DB: ${allDocsCount} (${legacyDocsCount} without sessionId - ignored)`);
  
  if (documents.length > 0) {
    console.log('Documents:', documents.map((d: any) => ({
      filename: d.filename,
      sessionId: d.sessionId,
      uploadDate: d.uploadDate
    })));
  }

  if (documents.length === 0) {
    // Check if there are documents from other sessions
    const anyDocuments = await Document.countDocuments();
    
    if (anyDocuments > 0 && sessionId) {
      streamCallback({
        type: "thinking",
        step: `⚠️ Found ${anyDocuments} document(s) from other sessions - isolated to prevent data bleed. Upload files for this conversation.`,
      });
    } else {
      streamCallback({
        type: "thinking",
        step: "⚠️ No documents found - upload a file to get started",
      });
    }
    
    return {
      thinking: ["No documents in this session"],
      finalResponse: documents.length === 0 && anyDocuments > 0 && sessionId
        ? `I found ${anyDocuments} document(s) from other chat sessions, but I'm keeping them isolated to prevent confusion. Please upload the files you want to work with in this conversation.`
        : "Please upload a document first to get started.",
      documents: [],
      vectorResults: [],
    };
  }

  const docInfo = documents.map((d: any) => `${d.filename} (${d.fileType.toUpperCase()})`).join(", ");
  const thinking2 = await generateThinking("Documents loaded", {
    count: documents.length,
    files: docInfo,
    session: "current session only",
  });
  streamCallback({ type: "thinking", step: thinking2 });

  const lastMessage = state.messages[state.messages.length - 1].content;

  // Check if this is an aggregation query (count, sum, average, etc.)
  const isAggregation = detectAggregationQuery(lastMessage);

  if (isAggregation) {
    const csvDoc = documents.find((d: any) => d.fileType === "csv");
    const totalRows = csvDoc?.extractedData?.parsedData?.length || 0;
    
    const thinking3 = await generateThinking("Detected aggregation/ranking query", {
      query: lastMessage.substring(0, 50),
      totalRows,
      approach: "using complete dataset, not vector search",
    });
    streamCallback({ type: "thinking", step: thinking3 });

    console.log("📊 Aggregation query detected - skipping vector search");

    // For aggregation queries, return ALL documents with full data
    // Don't use vector search as it only returns top 5 chunks (partial data)
    return {
      documents,
      vectorResults: documents, // Use full documents instead of limited vector results
    };
  }

  // For semantic/retrieval queries, use vector search
  const thinking4 = await generateThinking("Starting vector search", {
    query: lastMessage.substring(0, 50),
    method: "AI embeddings",
  });
  streamCallback({ type: "thinking", step: thinking4 });

  const queryEmbedding = await generateEmbedding(lastMessage);

  // Vector search - get results then filter by sessionId
  // Must use $match AFTER $vectorSearch since $vectorSearch must be first stage
  const allVectorResults = await Document.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "chunks.embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 50, // Get more results to ensure we have enough after filtering
      },
    },
    {
      $project: {
        _id: 1,
        filename: 1,
        fileType: 1,
        sessionId: 1,
        chunks: 1,
        extractedData: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
    // Filter by sessionId AFTER vector search
    ...(sessionId ? [{
      $match: {
        sessionId: sessionId
      }
    }] : []),
    {
      $limit: 5 // Take top 5 after filtering
    }
  ]);

  console.log(`🔍 Vector search filtered by sessionId: ${allVectorResults.length} results in current session`);
  
  if (allVectorResults.length > 0) {
    console.log('Results:', allVectorResults.map((d: any) => ({
      filename: d.filename,
      sessionId: d.sessionId,
      score: d.score?.toFixed(4)
    })));
  }

  const vectorResults = allVectorResults;

  const topScore = vectorResults[0]?.score ? (vectorResults[0].score * 100).toFixed(1) : 0;
  const thinking5 = await generateThinking("Vector search completed", {
    results: vectorResults.length,
    topRelevance: topScore + "%",
  });
  streamCallback({ type: "thinking", step: thinking5 });

  console.log("🔍 Vector search completed:");
  console.log("  Results:", vectorResults.length);
  console.log("  Top result score:", vectorResults[0]?.score?.toFixed(4));

  return {
    documents,
    vectorResults,
  };
}

async function prepareEmail(
  state: AgentState,
  streamCallback: StreamCallback
): Promise<Partial<AgentState>> {
  const thinking1 = await generateThinking("Looking for resume data", {
    action: "extracting candidate contact info",
  });
  streamCallback({ type: "thinking", step: thinking1 });

  const resumeDoc = state.documents.find((d) => d.fileType === "pdf");
  const lastMessage = state.messages[state.messages.length - 1].content;

  console.log("📄 Resume document:", resumeDoc ? {
    filename: resumeDoc.filename,
    hasExtractedData: !!resumeDoc.extractedData,
    email: resumeDoc.extractedData?.email,
    name: resumeDoc.extractedData?.name,
  } : 'NOT FOUND');

  if (!resumeDoc) {
    streamCallback({
      type: "thinking",
      step: "⚠️ No resume (PDF) found - cannot send email",
    });
    return {
      thinking: ["No resume found"],
      finalResponse: "Could not find a resume document. Please upload a PDF resume first.",
    };
  }

  // Check if we have email - name can be extracted if missing
  if (!resumeDoc.extractedData?.email) {
    streamCallback({
      type: "thinking",
      step: "⚠️ Resume missing email address - cannot send email",
    });
    return {
      thinking: ["Missing email"],
      finalResponse: "Could not extract email address from resume. Please ensure the resume contains an email address.",
    };
  }

  // If name is missing, try to extract from email or use GPT
  let candidateName = resumeDoc.extractedData.name;
  
  if (!candidateName) {
    streamCallback({
      type: "thinking",
      step: "🔍 Name not found - trying to extract from resume text using GPT...",
    });
    
    // Use GPT to extract name from resume text
    const nameExtractionPrompt = `Extract the candidate's full name from this resume text. Return ONLY the name, nothing else.

Resume text:
${resumeDoc.extractedData?.rawText?.substring(0, 1000)}

Full Name:`;

    try {
      const nameResponse = await getModel().invoke([new HumanMessage(nameExtractionPrompt)]);
      candidateName = nameResponse.content.toString().trim();
      console.log("✅ Extracted name with GPT:", candidateName);
      
      streamCallback({
        type: "thinking",
        step: `✅ Found name: ${candidateName}`,
      });
    } catch (error) {
      // Fallback: use email username
      candidateName = resumeDoc.extractedData.email.split('@')[0].replace(/[._-]/g, ' ');
      console.log("⚠️ Using email username as name:", candidateName);
    }
  }

  const thinking2 = await generateThinking("Candidate info found", {
    name: candidateName,
    email: resumeDoc.extractedData.email,
  });
  streamCallback({ type: "thinking", step: thinking2 });

  const thinking3 = await generateThinking("Extracting offer details with GPT", {
    query: lastMessage.substring(0, 50),
  });
  streamCallback({ type: "thinking", step: thinking3 });

  const extractionPrompt = `Extract the job position and salary from this message: "${lastMessage}"

Look for:
- Position/Role: Job title mentioned
- Salary: Any salary amount mentioned

Respond with JSON only:
{
  "position": "extracted position or 'Software Engineer'",
  "salary": "extracted salary or 'Competitive'"
}`;

  const extractionResponse = await getModel().invoke([
    new HumanMessage(extractionPrompt),
  ]);
  let content = extractionResponse.content as string;
  content = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const extracted = JSON.parse(content);

  const emailData = {
    name: candidateName, // Use the extracted/fallback name
    email: resumeDoc.extractedData.email,
    position: extracted.position,
    salary: extracted.salary,
  };

  const thinking4 = await generateThinking("Offer email ready", {
    position: emailData.position,
    salary: emailData.salary,
  });
  streamCallback({ type: "thinking", step: thinking4 });

  return {
    emailData,
  };
}

async function generateResponse(
  state: AgentState,
  streamCallback: StreamCallback
): Promise<Partial<AgentState>> {
  if (state.shouldEmail && state.emailData) {
    const thinking = await generateThinking("Creating email preview", {
      recipient: state.emailData.name,
      position: state.emailData.position,
    });
    streamCallback({ type: "thinking", step: thinking });

    const emailPreviewResponse = JSON.stringify({
      type: "EMAIL_PREVIEW",
      emailData: state.emailData,
    });

    // Send email preview as a special event type with complete data
    streamCallback({
      type: "email_preview",
      content: emailPreviewResponse,
    } as any);

    return { finalResponse: emailPreviewResponse };
  }

  const lastMessage = state.messages[state.messages.length - 1].content;

  console.log("🔍 Checking if chart request...");
  const thinkingChart = await generateThinking("Checking if visualization needed", {
    query: lastMessage.substring(0, 50),
  });
  streamCallback({ type: "thinking", step: thinkingChart });
  
  const isChartRequest = await detectChartRequest(lastMessage);
  
  if (isChartRequest) {
    console.log("✅ Chart request detected!");
    const thinking2 = await generateThinking("Chart request confirmed", {
      action: "checking available data sources",
    });
    streamCallback({ type: "thinking", step: thinking2 });

    const csvDoc = state.documents.find((d) => d.fileType === "csv");
    const pdfDocs = state.documents.filter((d) => d.fileType === "pdf");
    console.log("📄 CSV document found:", !!csvDoc);
    console.log("📄 PDF documents found:", pdfDocs.length);

    // Check if user is asking for a chart but only has PDF resumes
    if (!csvDoc && pdfDocs.length > 0) {
      const thinking3 = await generateThinking("Chart not possible", {
        reason: "Only PDF resumes available, no CSV data",
        pdfCount: pdfDocs.length,
      });
      streamCallback({ type: "thinking", step: thinking3 });
      
      // Fall through to text response explaining the limitation
      const thinking4 = await generateThinking("Providing text explanation", {
        reason: "PDFs don't contain structured data for charts",
      });
      streamCallback({ type: "thinking", step: thinking4 });
      
      // Don't return early - let it generate a helpful text response
    } else if (csvDoc && csvDoc.extractedData?.parsedData) {
      // We have CSV data - check if it's relevant to the query
      const csvFilename = csvDoc.filename.toLowerCase();
      const queryLower = lastMessage.toLowerCase();
      
      // Check if query mentions resume/candidate but we're about to use CSV
      const mentionsResume = queryLower.includes("resume") || 
                            queryLower.includes("candidate") || 
                            queryLower.includes("applicant") ||
                            queryLower.includes("cv");
      
      if (mentionsResume && pdfDocs.length > 0) {
        const thinking3 = await generateThinking("Context mismatch detected", {
          query: "asks about resume",
          availableData: "CSV has employee/other data",
        });
        streamCallback({ type: "thinking", step: thinking3 });
        
        // Fall through to text response
      } else {
        // Use the actual parsed CSV data
        const csvData = csvDoc.extractedData.parsedData as Array<Record<string, unknown>>;
        console.log("📊 CSV data rows:", csvData.length);
        
        const thinking3 = await generateThinking("Processing CSV for chart", {
          rows: csvData.length,
          columns: csvDoc.extractedData.columns?.length || 0,
          filename: csvDoc.filename,
        });
        streamCallback({ type: "thinking", step: thinking3 });

        const chartData = await prepareChartData(csvData, lastMessage);

        if (chartData) {
          const actualCount = chartData.data.length;
          const thinking4 = await generateThinking("Chart ready", {
            type: chartData.chartType,
            dataPoints: actualCount,
            metrics: chartData.yKeys.join(", "),
          });
          streamCallback({ type: "thinking", step: thinking4 });

          console.log("📤 Sending chart response as complete object");

          // Send chart as a special event type with complete data
          streamCallback({
            type: "chart",
            content: JSON.stringify(chartData),
          } as any);

          return { finalResponse: JSON.stringify(chartData) };
        } else {
          streamCallback({
            type: "thinking",
            step: "⚠️ Could not prepare chart - CSV structure may not be suitable",
          });
        }
      }
    } else if (!csvDoc) {
      streamCallback({
        type: "thinking",
        step: "⚠️ No CSV data available - charts require structured tabular data",
      });
    }
  }

  const thinking5 = await generateThinking("Preparing text response", {
    hasContext: state.vectorResults?.length > 0 || state.documents?.length > 0,
  });
  streamCallback({ type: "thinking", step: thinking5 });

  // Check if this is an aggregation query
  const isAggregation = detectAggregationQuery(lastMessage);

  let context = "";

  if (isAggregation) {
    // For aggregation queries, use FULL CSV data (not just chunks)
    console.log("📊 Building context from FULL CSV data for aggregation");

    const csvDocs = state.documents.filter((d: any) => d.fileType === "csv");

    if (csvDocs.length > 0) {
      const totalRows = csvDocs[0]?.extractedData?.parsedData?.length || 0;
      const thinking = await generateThinking("Loading full dataset", {
        totalRows,
        reason: "aggregation/ranking query needs complete data",
      });
      streamCallback({ type: "thinking", step: thinking });
      
      context = csvDocs
        .map((doc: any) => {
          const csvData = doc.extractedData?.parsedData;
          if (csvData && Array.isArray(csvData)) {
            // Safeguard: Limit to 1000 rows to avoid token limits
            const MAX_ROWS = 1000;
            const dataToUse = csvData.length > MAX_ROWS
              ? csvData.slice(0, MAX_ROWS)
              : csvData;

            const dataStr = JSON.stringify(dataToUse, null, 2);

            const warning = csvData.length > MAX_ROWS
              ? `\n⚠️ NOTE: Showing first ${MAX_ROWS} of ${csvData.length} rows to avoid token limits.`
              : "";

            if (csvData.length > MAX_ROWS) {
              streamCallback({
                type: "thinking",
                step: `⚠️ Dataset has ${csvData.length} rows - truncating to ${MAX_ROWS} for token limits`,
              });
            }

            return `Document: ${doc.filename} (CSV with ${csvData.length} rows)
Columns: ${doc.extractedData?.columns?.join(", ")}${warning}

COMPLETE DATA (ALL ${dataToUse.length} ROWS):
${dataStr}`;
          }
          return `Document: ${doc.filename}\n${
            doc.extractedData?.rawText?.slice(0, 2000) || "No content"
          }`;
        })
        .join("\n\n---\n\n");
    } else {
      // Fallback to other documents if no CSV
      const thinking = await generateThinking("Using PDF documents", {
        reason: "no CSV found for aggregation",
      });
      streamCallback({ type: "thinking", step: thinking });
      
      context = state.documents
        .map(
          (d: any) =>
            `Document: ${d.filename}\n${
              d.extractedData?.rawText?.slice(0, 5000) || "No content"
            }`
        )
        .join("\n\n");
    }

    console.log("📊 Full dataset context:", context.length, "characters");
    console.log("📊 CSV rows included:", csvDocs[0]?.extractedData?.parsedData?.length || 0);
  } else {
    // For semantic/retrieval queries, use vector search results (top chunks only)
    const thinking = await generateThinking("Building context from vector results", {
      chunks: state.vectorResults?.length || 0,
    });
    streamCallback({ type: "thinking", step: thinking });
    
    context =
      state.vectorResults && state.vectorResults.length > 0
        ? state.vectorResults
            .map((doc: any) => {
              // Extract top chunks from vector search results
              const topChunks = doc.chunks
                ?.slice(0, 3)
                .map((chunk: any) => chunk.content)
                .join("\n\n");
              return `Document: ${doc.filename} (Relevance: ${(
                doc.score * 100
              ).toFixed(1)}%)\n${topChunks}`;
            })
            .join("\n\n---\n\n")
        : state.documents
            .map(
              (d: any) =>
                `Document: ${d.filename}\n${
                  d.extractedData?.rawText?.slice(0, 2000) || "No content"
                }`
            )
            .join("\n\n");

    console.log("📄 Context source: Vector search results");
    console.log("📄 Context length:", context.length, "characters");
  }

  // Create appropriate prompt based on query type
  const thinking6 = await generateThinking("Sending to GPT-4 for answer", {
    contextSize: context.length,
    queryType: isAggregation ? "aggregation" : "semantic search",
  });
  streamCallback({ type: "thinking", step: thinking6 });
  
  // Check what types of documents we have
  const hasCSV = state.documents.some((d: any) => d.fileType === "csv");
  const hasPDF = state.documents.some((d: any) => d.fileType === "pdf");
  const docSummary = state.documents.map((d: any) => `${d.filename} (${d.fileType})`).join(", ");
  
  const prompt = isAggregation
    ? `You are analyzing a COMPLETE dataset for an aggregation query. The context below contains ALL rows of data - not a sample.

Available documents: ${docSummary}

Context:
${context}

Question: ${lastMessage}

IMPORTANT:
- This is the COMPLETE dataset with ALL rows included
- For counting queries, count ALL rows that match the criteria
- For totals/sums, include ALL matching values
- Do NOT estimate or say "approximately" - give exact counts from the complete data provided
- Show your calculation if helpful
${!hasCSV && hasPDF ? "\n- NOTE: If the user asks for charts/graphs, explain that PDF resumes don't contain structured data for visualizations. They need to upload a CSV file with tabular data." : ""}

Provide an accurate, exact answer based on the complete dataset.`
    : `Based on the following context, answer the question.

Available documents: ${docSummary}

Context:
${context}

Question: ${lastMessage}

${!hasCSV && hasPDF ? "NOTE: If the user asks for charts/graphs, explain that PDF resumes don't contain structured data for visualizations. They need to upload a CSV file with tabular data for charts." : ""}

Provide a clear, concise answer.`;

  const response = await getModel().invoke([new HumanMessage(prompt)]);
  const fullResponse = response.content as string;

  const words = fullResponse.split(" ");
  for (let i = 0; i < words.length; i++) {
    const word = words[i] + (i < words.length - 1 ? " " : "");
    streamCallback({ type: "response", content: word });
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  return { finalResponse: fullResponse };
}

function routeAgent(state: AgentState): string {
  if (state.finalResponse && state.finalResponse !== "") {
    return "end";
  }
  if (state.shouldEmail && !state.emailData) {
    return "prepareEmail";
  }
  if (!state.documents || state.documents.length === 0) {
    return "retrieveContext";
  }
  return "generateResponse";
}

export async function runAgentStream(
  userMessage: string,
  streamCallback: StreamCallback,
  sessionId?: string
): Promise<void> {
  const sentSteps = new Set<string>();

  const dedupedCallback = (event: StreamEvent) => {
    if (event.type === "thinking" && event.step) {
      if (sentSteps.has(event.step)) {
        return;
      }
      sentSteps.add(event.step);
    }
    streamCallback(event);
  };

  const workflow = new StateGraph(AgentStateAnnotation)
    .addNode("analyzeIntent", async (state) =>
      analyzeIntent(state, dedupedCallback)
    )
    .addNode("retrieveContext", async (state) =>
      retrieveContext(state, dedupedCallback, sessionId)
    )
    .addNode("prepareEmail", async (state) =>
      prepareEmail(state, dedupedCallback)
    )
    .addNode("generateResponse", async (state) =>
      generateResponse(state, dedupedCallback)
    )
    .addEdge("__start__", "analyzeIntent")
    .addEdge("analyzeIntent", "retrieveContext")
    .addConditionalEdges("retrieveContext", routeAgent, {
      prepareEmail: "prepareEmail",
      generateResponse: "generateResponse",
      end: "__end__",
    })
    .addConditionalEdges("prepareEmail", routeAgent, {
      generateResponse: "generateResponse",
      end: "__end__",
    })
    .addEdge("generateResponse", "__end__");

  const app = workflow.compile();

  const initialState: AgentState = {
    messages: [{ role: "user", content: userMessage }],
    thinking: [],
    documents: [],
    vectorResults: [],
    shouldEmail: false,
    emailData: null,
    finalResponse: "",
  };

  await app.invoke(initialState);
}
