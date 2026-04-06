import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildAnalyticsContext } from '@/lib/analytics-queries';
import { AI_TOOLS, executeAiTool } from '@/lib/ai-tools';
import type { FilterState } from '@/lib/types';

const SYSTEM_PROMPT = `You are **Shelby AI Analyst**, a senior financial controller and operational analyst for a multi-brand Quick Service Food (QSF) restaurant portfolio.

## Your Analytical Environment
You have direct access to a "Data Query Console" through various tools. Use these tools to fetch pinpoint-accurate data from the database.

### 📊 Database Schema Knowledge (Prior Knowledge)
The database table is \`fact_store_month\`. Each row represents one store for one month.
- **Dimensions**: \`store\`, \`concept\`, \`region\`, \`year\`, \`month\`.
- **Core Metrics**:
    - \`sales\`: Revenue in EUR.
    - \`ebitda\`: Earnings before interest, taxes, depreciation, and amortization.
    - \`capex\`: Capital expenditures (Investments).
    - \`fcff\`: Free Cash Flow (\`EBITDA - CAPEX - CIT\`).
    - \`staff\`: Total staff cost (\`Staff % = staff / sales\`).
    - \`raw_materials\`: Total COGS (\`Raw Mat % = raw_materials / sales\`).

## Your Operational Protocol
1.  **Analyze the Question**: Determine exactly what data you need (e.g., "I need 2024 total Sales and 2025 total Sales for Italian Republic").
2.  **Call the Tools**: Use \`get_aggregated_metrics\` for totals or \`get_monthly_metrics_feed\` for trend details.
3.  **Perform Internal Math**: Once you have the raw numbers from the tools, perform the subtraction/margins yourself to ensure 100% accuracy.
4.  **No Hallucinations**: NEVER claim data is missing without first trying to fetch it via the correct year/concept tool call.

## Response Format
Structure every answer professionally:
1.  **Executive Summary**: A 1-sentence bottom-line answer.
2.  **Comparative Analysis**: Use a Markdown Table for metrics.
3.  **Calculation Audit**: Use your methodology section to list the raw numbers you retrieved and how you combined them.
4.  **Strategic Insight**: One actionable recommendation based on the data.

## Rules
- **Model Reasoning**: Think step-by-step.
- **Accuracy First**: Only use data returned by tools.
- **Default Profitability**: Use EBITDA unless specified.
`;

function buildInitialContext(ctx: any): string {
  return `## Current Dashboard Filters
- **Period**: ${ctx.periodLabel}
- **Selected Filters**: ${ctx.filterDescription}
- **Available History**: ${ctx.availablePeriods}

### Dashboard KPI Summary (Pre-Aggregated for Current Filter)
- Total Sales: ${ctx.portfolio.totalSales.toLocaleString()}
- Total EBITDA: ${ctx.portfolio.totalEbitda.toLocaleString()}
- Store Count: ${ctx.portfolio.storeCount}

*Note: You have access to tools to fetch any other historical or detailed data needed for deep analysis.*`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key missing' }, { status: 500 });
    }

    const body = await request.json();
    const { messages, filters } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      filters: FilterState;
    };

    const openai = new OpenAI({ apiKey });
    const analyticsContext = await buildAnalyticsContext(filters);

    const openaiMessages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: buildInitialContext(analyticsContext) },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    let iteration = 0;
    const MAX_ITERATIONS = 5;

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: openaiMessages,
        tools: AI_TOOLS as any,
        tool_choice: 'auto',
        temperature: 0,
      });

      const message = response.choices[0].message;

      // If there's a final answer, return it
      if (!message.tool_calls || message.tool_calls.length === 0) {
        const latencyMs = Date.now() - startTime;
        return NextResponse.json({
          reply: message.content || 'No response generated.',
          meta: { latencyMs, iteration, tokens: response.usage?.total_tokens ?? 0 }
        });
      }

      // Handle Tool Calls
      openaiMessages.push(message);

      for (const toolCall of message.tool_calls) {
        // Narrow the type manually if needed, but for OpenAI SDK 4.x this is usually fine
        const toolParams = (toolCall as any).function;
        const name = toolParams.name;
        const args = JSON.parse(toolParams.arguments);
        
        console.log(\`[AI Tool Call] \${name}\`, args);
        
        try {
          const result = await executeAiTool(name, args);
          openaiMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        } catch (toolError: any) {
          openaiMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: toolError.message })
          });
        }
      }
    }

    return NextResponse.json({ 
      error: 'The analysis required too many data retrieval steps.' 
    }, { status: 500 });

  } catch (err: unknown) {
    console.error('[AI Chat Error]', err);
    return NextResponse.json({ error: 'Processing error.' }, { status: 500 });
  }
}
