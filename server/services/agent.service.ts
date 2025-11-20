import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { StateGraph, END, Annotation } from "@langchain/langgraph";
import Document from "../models/Document";
import { generateEmbedding } from "./vector.service";
import { sendOfferEmail } from "./email.service";
import connectDB from "../config/db";

// Lazy initialization of model to ensure env vars are loaded
let model: ChatOpenAI | null = null;

function getModel(): ChatOpenAI {
  if (!model) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
      temperature: 0.7,
    });
  }
  return model;
}

const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  thinking: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  documents: Annotation<any[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  shouldEmail: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  emailData: Annotation<any>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
  plan: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  retrievedData: Annotation<any>({
    reducer: (x, y) => y ?? x,
    default: () => ({}),
  }),
  finalResponse: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
});

interface AgentState {
  messages: any[];
  thinking: string[];
  documents: any[];
  shouldEmail: boolean;
  emailData?: {
    name: string;
    email: string;
    position: string;
    salary?: string;
  };
  plan: string[];
  retrievedData: {
    resume?: any;
    jobDescription?: any;
  };
  finalResponse: string;
}

async function analyzeIntent(state: AgentState): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1].content;
  const thinking = [...state.thinking, "Analyzing user intent..."];

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

Respond with JSON only:
{
  "requiresEmail": boolean,
  "reasoning": string
}

Examples:
"Is this candidate good?" → false
"What do you think of this candidate?" → false
"Send an offer letter" → true
"Draft an offer email for Senior Engineer at $150k" → true`;

  const response = await getModel().invoke([new HumanMessage(prompt)]);
  let content = response.content as string;

  content = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const analysis = JSON.parse(content);

  thinking.push(analysis.reasoning);

  return { thinking, shouldEmail: analysis.requiresEmail };
}

async function retrieveData(state: AgentState): Promise<Partial<AgentState>> {
  await connectDB();
  const thinking = [...state.thinking, "Retrieving documents from database..."];

  const documents = await Document.find().sort({ uploadDate: -1 }).limit(5);
  thinking.push(`Found ${documents.length} documents`);

  return { thinking, documents };
}

async function executeRetrieval(
  state: AgentState
): Promise<Partial<AgentState>> {
  const thinking = [...state.thinking];
  const lastMessage = state.messages[state.messages.length - 1].content;
  const retrievedData: any = {};

  // Check if message mentions job description
  const hasJD =
    /job description|jd|job requirements|position requirements/i.test(
      lastMessage
    );

  if (hasJD) {
    thinking.push("📄 Reading job description from context...");

    // Extract JD from the conversation (user's follow-up message)
    const jdMessage = state.messages.find(
      (m: any) =>
        m.content &&
        /AI Engineer|job|position|role/i.test(m.content) &&
        m.role !== "assistant"
    );

    if (jdMessage) {
      retrievedData.jobDescription = {
        role: "AI Engineer",
        description: jdMessage.content,
        requirements: [
          "Python",
          "Machine Learning",
          "Deep Learning",
          "RAG",
          "LLM",
        ],
      };
      thinking.push("✅ Job description identified");
    } else {
      thinking.push("⚠️ No job description found in conversation");
    }
  }

  thinking.push("📄 Reading resume from database...");
  const resumeDoc = state.documents.find((d) => d.fileType === "pdf");

  if (resumeDoc) {
    const queryEmbedding = await generateEmbedding(lastMessage);

    const vectorResults = await Document.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "chunks.embedding",
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: 5,
        },
      },
      {
        $project: {
          _id: 1,
          chunks: 1,
          extractedData: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    retrievedData.resume = {
      chunks: vectorResults,
      extractedData: resumeDoc.extractedData,
    };

    thinking.push("✅ Resume data retrieved");
  }

  return { thinking, retrievedData };
}

async function createPlan(state: AgentState): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1].content;
  const thinking = [...state.thinking, "🧠 Creating execution plan..."];

  const planningPrompt = `Analyze this request and create a step-by-step plan: "${lastMessage}"
  
If the request requires comparing resume with job description or involves multiple data sources, create a multi-step plan.

Respond with JSON only:
{
  "needsMultiStep": boolean,
  "steps": ["step 1", "step 2", ...],
  "reasoning": "why this plan"
}

Examples:
- "What are the skills?" → needsMultiStep: false, steps: ["Retrieve resume", "Extract skills"]
- "Compare resume with JD" → needsMultiStep: true, steps: ["Retrieve resume", "Retrieve job description", "Compare skills", "Identify gaps"]`;

  const response = await getModel().invoke([new HumanMessage(planningPrompt)]);
  let content = response.content as string;
  content = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const planData = JSON.parse(content);

  thinking.push(`📋 Plan: ${planData.reasoning}`);
  planData.steps.forEach((step: string, i: number) => {
    thinking.push(`  ${i + 1}. ${step}`);
  });

  return {
    thinking,
    plan: planData.steps,
  };
}

async function processQuery(state: AgentState): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1].content;
  const thinking = [
    ...state.thinking,
    "🔄 Processing and synthesizing data...",
  ];

  if (state.documents.length === 0) {
    return {
      thinking: [...thinking, "No documents found"],
      finalResponse:
        "No documents have been uploaded yet. Please upload a resume first.",
    };
  }

  try {
    // Check if we have multi-source data
    const hasMultipleSources =
      state.retrievedData?.jobDescription && state.retrievedData?.resume;

    let context = "";
    let systemPrompt = "";

    if (hasMultipleSources) {
      thinking.push("🔀 Comparing resume with job description...");

      // Extract resume content
      const resumeChunks = state.retrievedData.resume.chunks || [];
      let resumeContent: string[] = [];
      for (const result of resumeChunks) {
        if (result.chunks && Array.isArray(result.chunks)) {
          for (const chunk of result.chunks) {
            if (chunk.content) {
              resumeContent.push(chunk.content);
            }
          }
        }
      }

      context = resumeContent.slice(0, 3).join("\n\n");

      systemPrompt = `You are an AI recruiter assistant performing a detailed comparison.

RESUME CONTEXT:
${context}

CANDIDATE INFO:
- Name: ${state.retrievedData.resume.extractedData?.name || "Not found"}
- Email: ${state.retrievedData.resume.extractedData?.email || "Not found"}
- Skills: ${
        state.retrievedData.resume.extractedData?.skills?.join(", ") ||
        "Not found"
      }

JOB DESCRIPTION:
- Role: ${state.retrievedData.jobDescription.role}
- Description: ${state.retrievedData.jobDescription.description}
- Key Requirements: ${state.retrievedData.jobDescription.requirements.join(
        ", "
      )}

TASK: Compare the candidate's resume with the job requirements. Provide:
1. **Matching Skills**: Skills the candidate has that match requirements
2. **Missing Skills**: Requirements the candidate doesn't meet
3. **Additional Strengths**: Relevant skills beyond requirements
4. **Recommendation**: Whether to proceed with this candidate

Be specific and detailed in your comparison.`;

      thinking.push("✅ Comparison complete");
    } else {
      thinking.push("📊 Processing single-source query...");

      const resumeDoc = state.documents.find((d) => d.fileType === "pdf");
      const queryEmbedding = await generateEmbedding(lastMessage);

      const vectorResults = await Document.aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "chunks.embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 5,
          },
        },
        {
          $project: {
            _id: 1,
            chunks: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ]);

      let allContent: string[] = [];
      for (const result of vectorResults) {
        if (result.chunks && Array.isArray(result.chunks)) {
          for (const chunk of result.chunks) {
            if (chunk.content) {
              allContent.push(chunk.content);
            }
          }
        }
      }

      context = allContent.slice(0, 3).join("\n\n");

      systemPrompt = `You are an AI recruiter assistant. Use the following resume context to answer questions.
    
Resume Context:
${context}

Extracted Info:
Name: ${resumeDoc.extractedData?.name || "Not found"}
Email: ${resumeDoc.extractedData?.email || "Not found"}
Phone: ${resumeDoc.extractedData?.phone || "Not found"}
Skills: ${resumeDoc.extractedData?.skills?.join(", ") || "Not found"}`;
    }

    const response = await getModel().invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(lastMessage),
    ]);

    thinking.push("✅ Response generated successfully");

    return {
      thinking,
      finalResponse: response.content as string,
    };
  } catch (error: any) {
    console.error("=== PROCESSING ERROR ===");
    console.error("Error:", error.message);
    console.error("========================");

    return {
      thinking: [...thinking, `❌ Error: ${error.message}`],
      finalResponse: "Sorry, there was an error processing your query.",
    };
  }
}

async function prepareEmail(state: AgentState): Promise<Partial<AgentState>> {
  const thinking = [...state.thinking, "Preparing email data..."];
  const resumeDoc = state.documents.find((d) => d.fileType === "pdf");
  const lastMessage = state.messages[state.messages.length - 1].content;

  if (
    !resumeDoc ||
    !resumeDoc.extractedData?.email ||
    !resumeDoc.extractedData?.name
  ) {
    return {
      thinking: [...thinking, "Missing email or name"],
      finalResponse: "Could not extract candidate email or name from resume.",
    };
  }

  thinking.push("Extracting job details from your message...");

  const extractionPrompt = `Extract the job position and salary from this message: "${lastMessage}"

Look for:
- Position/Role: Job title mentioned (e.g., "Senior AI Engineer", "Software Engineer", "Data Scientist")
- Salary: Any salary amount mentioned (e.g., "$150,000", "$150k", "120000")

Respond with JSON only:
{
  "position": "extracted position title or 'Software Engineer' if not specified",
  "salary": "extracted salary with $ sign or 'Competitive' if not mentioned"
}

Examples:
"Send offer for Senior AI Engineer at $150k" → {"position": "Senior AI Engineer", "salary": "$150,000"}
"Draft offer letter for Data Scientist position with 120000 salary" → {"position": "Data Scientist", "salary": "$120,000"}
"Send an offer letter" → {"position": "Software Engineer", "salary": "Competitive"}`;

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
    name: resumeDoc.extractedData.name,
    email: resumeDoc.extractedData.email,
    position: extracted.position,
    salary: extracted.salary,
  };

  thinking.push(`Position: ${emailData.position}`);
  thinking.push(`Salary: ${emailData.salary}`);
  thinking.push(`Email will be sent to ${emailData.email}`);

  return { thinking, emailData };
}

async function shouldSendEmail(state: AgentState): Promise<string> {
  return state.shouldEmail ? "sendEmail" : "end";
}

const workflow = new StateGraph(AgentStateAnnotation)
  .addNode("analyzeIntent", analyzeIntent)
  .addNode("retrieveData", retrieveData)
  .addNode("createPlan", createPlan)
  .addNode("executeRetrieval", executeRetrieval)
  .addNode("processQuery", processQuery)
  .addNode("prepareEmail", prepareEmail)
  .addEdge("__start__", "analyzeIntent")
  .addEdge("analyzeIntent", "retrieveData")
  .addEdge("retrieveData", "createPlan")
  .addEdge("createPlan", "executeRetrieval")
  .addEdge("executeRetrieval", "processQuery")
  .addConditionalEdges("processQuery", shouldSendEmail, {
    sendEmail: "prepareEmail",
    end: END,
  })
  .addEdge("prepareEmail", END);

const app = workflow.compile();

export async function runAgent(
  userMessage: string,
  conversationHistory: any[] = []
) {
  const initialState: AgentState = {
    messages: [...conversationHistory, new HumanMessage(userMessage)],
    thinking: [],
    documents: [],
    shouldEmail: false,
    plan: [],
    retrievedData: {},
    finalResponse: "",
  };

  const result: any = await app.invoke(initialState);

  if (result.shouldEmail && result.emailData) {
    await sendOfferEmail(
      result.emailData.email,
      result.emailData.name,
      result.emailData.position,
      result.emailData.salary
    );
    result.finalResponse += `\n\n✉️ Offer email sent to ${result.emailData.email} for ${result.emailData.position} position with ${result.emailData.salary} compensation.`;
  }

  return {
    response: result.finalResponse,
    thinking: result.thinking,
    emailSent: result.shouldEmail,
  };
}
