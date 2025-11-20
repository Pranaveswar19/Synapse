import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

// Lazy initialization of model to ensure env vars are loaded
let model: ChatOpenAI | null = null;

function getModel(): ChatOpenAI {
  if (!model) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }
  return model;
}

interface ChartData {
  type: "CHART";
  chartType: "line" | "bar" | "pie" | "area";
  title: string;
  data: Array<{ [key: string]: string | number }>;
  xKey: string;
  yKeys: string[];
  description: string;
}

interface ChartIntent {
  isChartRequest: boolean;
  chartType: "bar" | "line" | "pie" | "area";
  topN: number | null;
  sortBy: string | null;
  sortOrder: "asc" | "desc";
  metrics: string[];
  xKey: string;
  title: string;
}

// GPT-powered chart request detection
export async function detectChartRequest(message: string): Promise<boolean> {
  const prompt = `Analyze if this is a request for a chart, graph, or visualization.

User message: "${message}"

Respond with ONLY "true" or "false" (no explanation).

Examples:
- "show me a chart" → true
- "make a bar chart" → true
- "visualize the data" → true
- "compare the top 5" → true
- "I meant top 5 performers" → true (implies visualization)
- "what is the average?" → false (just a question)
- "tell me about John" → false (specific query)`;

  try {
    const response = await getModel().invoke([new HumanMessage(prompt)]);
    const result = response.content.toString().trim().toLowerCase();
    console.log(`🔍 GPT Chart Detection: "${message}" → ${result}`);
    return result === "true";
  } catch (error) {
    console.error("❌ GPT detection failed, using fallback");
    // Fallback to keyword detection
    return (
      message.toLowerCase().includes("chart") ||
      message.toLowerCase().includes("graph") ||
      message.toLowerCase().includes("visualize")
    );
  }
}

// GPT-powered intent parsing
export async function parseChartIntent(
  message: string,
  availableColumns: string[]
): Promise<ChartIntent> {
  const prompt = `Analyze this chart/visualization request and extract parameters.

User message: "${message}"
Available columns: ${availableColumns.join(", ")}

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "isChartRequest": true,
  "chartType": "bar" | "line" | "pie" | "area",
  "topN": number or null,
  "sortBy": "column_name" or null,
  "sortOrder": "asc" | "desc",
  "metrics": ["column1", "column2"],
  "xKey": "column_name",
  "title": "descriptive title"
}

Rules for column selection:
- For X-axis: Use "Full_Name" if available for employee data, otherwise first categorical column
- For metrics: Choose 1-2 most relevant numeric columns based on the question
- For sorting: Infer from context (e.g., "top performers" → Performance_Rating, "highest paid" → Total_Compensation)

Examples:
"top 5 performers" →
{
  "isChartRequest": true,
  "chartType": "bar",
  "topN": 5,
  "sortBy": "Performance_Rating",
  "sortOrder": "desc",
  "metrics": ["Performance_Rating"],
  "xKey": "Full_Name",
  "title": "Top 5 Performers by Rating"
}

"compare salaries by department" →
{
  "isChartRequest": true,
  "chartType": "bar",
  "topN": null,
  "sortBy": "Total_Compensation",
  "sortOrder": "desc",
  "metrics": ["Total_Compensation"],
  "xKey": "Department",
  "title": "Salary Comparison by Department"
}

"show training hours trend" →
{
  "isChartRequest": true,
  "chartType": "line",
  "topN": null,
  "sortBy": null,
  "sortOrder": "asc",
  "metrics": ["Training_Hours"],
  "xKey": "Full_Name",
  "title": "Training Hours Distribution"
}`;

  try {
    const response = await getModel().invoke([new HumanMessage(prompt)]);
    const content = response.content.toString();

    // Strip markdown code blocks if present
    const jsonStr = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const intent: ChartIntent = JSON.parse(jsonStr);

    console.log("🧠 GPT Chart Intent:", JSON.stringify(intent, null, 2));

    return intent;
  } catch (error) {
    console.error("❌ GPT intent parsing failed:", error);

    // Fallback to basic intent
    return {
      isChartRequest: true,
      chartType: "bar",
      topN: null,
      sortBy: null,
      sortOrder: "desc",
      metrics: [],
      xKey:
        availableColumns.find((col) => col.includes("Name")) ||
        availableColumns[0],
      title: "Data Analysis",
    };
  }
}

// Clean numeric values
function cleanNumericValue(value: any): number {
  if (typeof value === "number") return value;
  const cleaned = String(value)
    .replace(/[$,\s%]/g, "")
    .trim();
  return !isNaN(Number(cleaned)) && cleaned !== "" ? Number(cleaned) : 0;
}

// Main chart preparation function
export async function prepareChartData(
  csvData: any[],
  message: string
): Promise<ChartData | null> {
  console.log("\n📊 prepareChartData called (GPT-powered)");
  console.log("  CSV data length:", csvData.length);
  console.log("  Message:", message);

  if (!csvData || csvData.length === 0) {
    console.log("❌ No CSV data provided");
    return null;
  }

  const columns = Object.keys(csvData[0]);
  console.log("  Columns:", columns);

  // Identify numeric columns
  const numericColumns = columns.filter((col) => {
    const sampleSize = Math.min(5, csvData.length);
    let numericCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      const value = csvData[i][col];
      const cleaned = String(value)
        .replace(/[$,\s%]/g, "")
        .trim();
      if (cleaned && !isNaN(Number(cleaned)) && cleaned !== "") {
        numericCount++;
      }
    }

    return numericCount >= sampleSize * 0.8;
  });

  console.log("  Numeric columns:", numericColumns);

  if (numericColumns.length === 0) {
    console.log("❌ No numeric columns found");
    return null;
  }

  // Use GPT to parse intent
  const intent = await parseChartIntent(message, columns);

  // Validate columns exist
  if (!columns.includes(intent.xKey)) {
    console.log(`⚠️ X-key "${intent.xKey}" not found, using fallback`);
    intent.xKey = columns.find((col) => col.includes("Name")) || columns[0];
  }

  // Filter metrics to only valid numeric columns
  let yKeys = intent.metrics.filter((m) => numericColumns.includes(m));

  if (yKeys.length === 0) {
    // Fallback: use sort column or first numeric column
    yKeys =
      intent.sortBy && numericColumns.includes(intent.sortBy)
        ? [intent.sortBy]
        : [numericColumns[0]];
  }

  console.log(`  ✅ Using metrics: ${yKeys.join(", ")}`);

  // Process data
  let processedData = [...csvData];

  // Sort if needed
  if (intent.sortBy && numericColumns.includes(intent.sortBy)) {
    processedData.sort((a, b) => {
      const aVal = cleanNumericValue(a[intent.sortBy!]);
      const bVal = cleanNumericValue(b[intent.sortBy!]);
      return intent.sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
    console.log(`  ✅ Sorted by ${intent.sortBy} (${intent.sortOrder})`);
  }

  // Filter to top N if specified
  if (intent.topN && intent.topN > 0) {
    const requestedCount = intent.topN;
    const availableCount = processedData.length;
    processedData = processedData.slice(0, intent.topN);
    console.log(`  ✅ Filtered to top ${intent.topN} items (requested: ${requestedCount}, available: ${availableCount})`);
  } else {
    // No specific limit requested - show reasonable number for visualization
    const maxVisualizationLimit = 50; // Increased from 20 to allow more data points
    if (processedData.length > maxVisualizationLimit) {
      processedData = processedData.slice(0, maxVisualizationLimit);
      console.log(`  ℹ️ Limited to ${maxVisualizationLimit} items for optimal visualization (${processedData.length} total available)`);
    }
  }

  // Prepare final chart data
  const chartData: ChartData = {
    type: "CHART",
    chartType: intent.chartType,
    title: intent.title,
    data: processedData.map((row) => {
      const cleaned: any = {
        [intent.xKey]: row[intent.xKey] || "Unknown",
      };

      yKeys.forEach((key) => {
        cleaned[key] = cleanNumericValue(row[key]);
      });

      return cleaned;
    }),
    xKey: intent.xKey,
    yKeys: yKeys,
    description: `Showing ${intent.chartType} chart for ${yKeys.join(", ")}`,
  };

  console.log("✅ Chart data prepared:");
  console.log(`   Type: ${chartData.chartType}`);
  console.log(`   Title: ${chartData.title}`);
  console.log(`   X-axis: ${chartData.xKey}`);
  console.log(`   Y-axis: ${chartData.yKeys.join(", ")}`);
  console.log(`   Data points: ${chartData.data.length}`);
  console.log(`   Sample:`, chartData.data[0]);

  return chartData;
}
