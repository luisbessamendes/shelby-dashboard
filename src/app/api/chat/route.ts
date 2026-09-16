import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat';
import { buildAnalyticsContext, type AnalyticsContext } from '@/lib/analytics-queries';
import { AI_TOOLS, executeAiTool } from '@/lib/ai-tools';
import type { FilterState } from '@/lib/types';

const SYSTEM_PROMPT = `You are **Shelby AI Analyst**, a senior financial controller and operational analyst for a multi-brand Quick Service Food (QSF) restaurant portfolio.

## Your Analytical Environment
You have direct access to a "Data Query Console" through various tools. Use these tools to fetch pinpoint-accurate data from the database.

### 📊 Database Schema Knowledge (Prior Knowledge)
The database table is \`fact_store_month\`. Each row represents one store for one month.
- **Dimensions**: \`store\`, \`code\`, \`concept\`, \`region\`, \`location\`, \`legal_entity\`, \`year\`, \`month\`.
- **Core Metrics**:
    - \`sales\`: Gross sales in EUR before VAT deduction.
    - \`vat\`: VAT deduction in EUR.
    - \`turnover\`: Net sales after VAT; this is the operating revenue base for margins.
    - Store EBITDAR: store profit BEFORE leases and headquarters. Equals legacy \`store_contribution\` plus \`rents\`. It is NOT EBITDA plus leases.
    - Store EBITDA: store profit AFTER leases and BEFORE headquarters; stored in \`store_contribution\` (formerly Store Contribution).
    - \`ebitda\`: profit AFTER leases and Headquarter & Admin. Equals Store EBITDA minus \`admin_costs\`.
    - Prime Cost is Food Cost plus Staff Cost. It is a subtotal, never an additional deduction.
    - All profitability margins are weighted totals divided by Turnover. Average Ticket is Gross Sales divided by Tickets.
    - \`capex\`: Capital expenditures (Investments).
    - \`fcff\`: Free Cash Flow (\`EBITDA - CAPEX - CIT\`).
    - \`staff\`: Total staff cost (\`Staff % = staff / turnover\`).
    - \`raw_materials\`: Total COGS (\`Raw Mat % = raw_materials / turnover\`).

## Your Operational Protocol
1.  **Analyze the Question**: Determine exactly what data you need (e.g., "I need 2024 total Turnover and 2025 total Turnover for Italian Republic").
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
- All query tools inherit the current dashboard scope. Keep Store, Concept, Region, Location, Legal Entity and Type filters unless the user changes them. Specify different periods only when requested for comparison.
- LTM requires 12 calendar months. Compare LTM to the same endpoint one year earlier, not to FY. Amount YoY is (current - prior) / abs(prior); zero prior amounts are unavailable. Margin changes are percentage points, including when the prior margin is zero.
- **Model Reasoning**: Think step-by-step.
- **Accuracy First**: Only use data returned by tools.
- **Default Profitability**: Use Store EBITDAR for unspecified operating-profit questions. Explicit EBITDA means after headquarters; never substitute EBITDAR for EBITDA or FCFF.
`;

function buildInitialContext(ctx: AnalyticsContext): string {
  const number = (value: number) => Number.isFinite(value) ? value.toLocaleString() : 'unavailable';
  const kpis = ctx.portfolio ? `
- Total Turnover: ${number(ctx.portfolio.totalTurnover)}
- Gross Sales: ${number(ctx.portfolio.totalSales)}
- Store EBITDAR: ${number(ctx.portfolio.totalStoreEbitdar)}
- Store EBITDA: ${number(ctx.portfolio.totalStoreEbitda)}
- Headquarters costs: ${number(ctx.portfolio.totalAdminCosts)}
- Total EBITDA: ${number(ctx.portfolio.totalEbitda)}
- Store Count: ${ctx.portfolio.storeCount}` : ctx.periodUnavailableReason;
  return `## Current Dashboard Filters
- **Period**: ${ctx.periodLabel}
- **Selected Filters**: ${ctx.filterDescription}
- **Available History**: ${ctx.availablePeriods}

### Dashboard KPI Summary (Pre-Aggregated for Current Filter)
${kpis}

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

    const openaiMessages: ChatCompletionMessageParam[] = [
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
        tools: AI_TOOLS as ChatCompletionTool[],
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
        if (toolCall.type !== 'function') continue;
        const { name, arguments: rawArguments } = toolCall.function;
        const args = JSON.parse(rawArguments) as Parameters<typeof executeAiTool>[1];
        
        console.log(`[AI Tool Call] ${name}`, args);
        
        try {
          const result = await executeAiTool(name, args, filters);
          openaiMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        } catch (toolError: unknown) {
          const message = toolError instanceof Error ? toolError.message : String(toolError);
          openaiMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: message })
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
