/* ────────────────────────────────────────────────────────
 * POST /api/chat — AI Analyst Chat Endpoint
 *
 * Server-side orchestrated: fetches data, builds context,
 * sends to OpenAI, returns structured response.
 * ──────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildAnalyticsContext } from '@/lib/analytics-queries';
import type { FilterState } from '@/lib/types';

const SYSTEM_PROMPT = `You are **Shelby AI Analyst**, an embedded financial and operational analyst for a multi-brand Quick Service Food (QSF) restaurant portfolio.

## Your Role
You answer questions about portfolio performance using ONLY the data provided below. You are precise, concise, and analytical — never vague or generic.

## Response Format
Structure every answer as:
1. **Direct answer** — One clear sentence answering the question
2. **Key figures** — The most relevant numbers (use € for currency)
3. **Explanation** — Brief context or insight (1-2 sentences max)
4. **Ranked list or table** — When comparing items, use a ranked bullet list
5. **Caveat** — State assumptions (e.g. "Using EBITDA as profitability metric") or data limitations
6. **Suggested follow-ups** — 1-2 natural next questions the user might ask

## Rules
- Use ONLY the data context provided. NEVER fabricate numbers.
- If data is missing or the question cannot be answered, say so clearly.
- When "profitability" is mentioned without specification, default to EBITDA and state this assumption.
- Format currency as €XXK or €X.XM. Format percentages with 1 decimal.
- Keep answers concise — aim for 150-250 words max.
- Use bold for metric names and store/concept/region names.
- When listing stores or concepts, include their key metrics.
- Reference the current analytical scope (period and filters) when relevant.
- **Payback Period Calculations**: To calculate payback in months, DO NOT divide total CAPEX by total EBITDA (this gives a fraction of the total period, not months). Instead: 1) Look at the Monthly History to find the specific month(s) when CAPEX was spent. 2) Calculate the **average monthly EBITDA** for the months *after* the CAPEX was completed. 3) Divide the CAPEX amount by that post-CAPEX average monthly EBITDA to get the payback period in months.
- **Time-Series / Year-Over-Year Data**: If asked to compare data across periods (e.g., "2024 vs 2025") for specific stores, and that historical data is NOT explicitly in the context, YOU MUST state clearly that you do not have the historical data. DO NOT attempt to use the current period's data to invent a comparison. DO NOT treat a formatted number and a raw number as different periods.
- **Rankings and Sorting**: When asked for "highest", "lowest", "top", or "bottom" items, ALWAYS perform a strict numerical comparison of the values. Sort descending for "top/highest" and ascending for "bottom/lowest". Never claim a lower number is "highest" or "more" than a larger number. For percentages, ensure 18% is treated as higher than 0%, and -10% is treated as lower than -5%.
`;

function buildContextMessage(ctx: Awaited<ReturnType<typeof buildAnalyticsContext>>): string {
  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
    return `€${n.toFixed(0)}`;
  };
  const pct = (n: number | null) => n != null ? `${(n * 100).toFixed(1)}%` : 'N/A';

  const p = ctx.portfolio;

  let text = `## Current Analytical Scope
- **Period**: ${ctx.periodLabel}
- **Filters**: ${ctx.filterDescription}
- **Data range**: ${ctx.availablePeriods}

## Portfolio KPIs
- Stores: ${p.storeCount}
- Total Sales: ${fmt(p.totalSales)}
- Total Tickets: ${p.totalTickets.toLocaleString()}
- Avg Ticket: ${fmt(p.avgTicket)}
- Raw Materials %: ${pct(p.rawMaterialsPct)}
- Staff %: ${pct(p.staffPct)}
- Rents %: ${pct(p.rentsPct)}
- Utilities %: ${pct(p.utilitiesPct)}
- Maintenance %: ${pct(p.maintenancePct)}
- Banking Costs %: ${pct(p.bankingCostsPct)}
- VAT %: ${pct(p.vatPct)}
- Others %: ${pct(p.othersPct)}
- Store Contribution: ${fmt(p.totalStoreContribution)} (${pct(p.storeContributionPct)})
- Admin Costs: ${fmt(p.totalAdminCosts)} (${pct(p.adminCostsPct)})
- EBITDA: ${fmt(p.totalEbitda)} (${pct(p.ebitdaPct)})
- CAPEX: ${fmt(p.totalCapex)}
- CIT (Corporate Income Tax): ${fmt(p.totalCit)}
- FCFF: ${fmt(p.totalFcff)} (${pct(p.fcffPct)})
- EBITDA-Negative Stores: ${p.ebitdaNegativeCount}
- FCFF-Negative Stores: ${p.fcffNegativeCount}
- Sales per Store: ${fmt(p.salesPerStore)}
- EBITDA per Store: ${fmt(p.ebitdaPerStore)}
- FCFF per Store: ${fmt(p.fcffPerStore)}
`;

  // Top stores
  if (ctx.topStores.length > 0) {
    text += `\n## Top Stores by EBITDA\n`;
    ctx.topStores.forEach((s, i) => {
      text += `${i + 1}. **${s.store}** (${s.concept}, ${s.region}) — EBITDA: ${fmt(s.ebitda)} (${pct(s.ebitdaPct)}), Sales: ${fmt(s.sales)}, CAPEX: ${fmt(s.capex)}, FCFF: ${fmt(s.fcff)}\n`;
    });
  }

  // Bottom stores
  if (ctx.bottomStores.length > 0) {
    text += `\n## Bottom Stores by EBITDA\n`;
    ctx.bottomStores.forEach((s, i) => {
      text += `${i + 1}. **${s.store}** (${s.concept}, ${s.region}) — EBITDA: ${fmt(s.ebitda)} (${pct(s.ebitdaPct)}), Sales: ${fmt(s.sales)}, CAPEX: ${fmt(s.capex)}, FCFF: ${fmt(s.fcff)}\n`;
    });
  }

  // EBITDA-negative stores
  if (ctx.ebitdaNegativeStores.length > 0) {
    text += `\n## EBITDA-Negative Stores\n`;
    ctx.ebitdaNegativeStores.forEach(s => {
      text += `- **${s.store}** (${s.concept}, ${s.region}) — EBITDA: ${fmt(s.ebitda)}, Sales: ${fmt(s.sales)}\n`;
    });
  }

  // Top stores by CAPEX
  if (ctx.topStoresByCapex.length > 0) {
    text += `\n## Top Stores by CAPEX (Investment)\n`;
    ctx.topStoresByCapex.forEach((s, i) => {
      text += `${i + 1}. **${s.store}** (${s.concept}, ${s.region}) — CAPEX: ${fmt(s.capex)}, Sales: ${fmt(s.sales)}, EBITDA: ${fmt(s.ebitda)}, FCFF: ${fmt(s.fcff)}\n`;
    });
  }

  // Concept summary
  if (ctx.conceptSummary.length > 0) {
    text += `\n## Performance by Concept (Brand)\n`;
    ctx.conceptSummary.forEach(c => {
      text += `- **${c.name}** — ${c.storeCount} stores, Sales: ${fmt(c.sales)}, EBITDA: ${fmt(c.ebitda)} (${pct(c.ebitdaPct)}), CAPEX: ${fmt(c.capex)}, CIT: ${fmt(c.cit)}, FCFF: ${fmt(c.fcff)}\n`;
    });
  }

  // Region summary
  if (ctx.regionSummary.length > 0) {
    text += `\n## Performance by Region\n`;
    ctx.regionSummary.forEach(r => {
      text += `- **${r.name}** — ${r.storeCount} stores, Sales: ${fmt(r.sales)}, EBITDA: ${fmt(r.ebitda)} (${pct(r.ebitdaPct)}), CAPEX: ${fmt(r.capex)}, CIT: ${fmt(r.cit)}, FCFF: ${fmt(r.fcff)}\n`;
    });
  }

  // Recent trends (all data timeline)
  const recentSales = ctx.trendSales;
  const recentEbitda = ctx.trendEbitda;
  const recentCapex = ctx.trendCapex || [];

  if (recentSales.length > 0) {
    text += `\n## PORTFOLIO TRENDS (Last ${recentSales.length} Months)\n`;
    recentSales.forEach(t => {
      text += `- ${t.period}: ${fmt(t.value)}\n`;
    });
  }
  if (recentEbitda.length > 0) {
    text += `\n## PORTFOLIO EBITDA TREND (Last ${recentEbitda.length} Months)\n`;
    recentEbitda.forEach(t => {
      text += `- ${t.period}: ${fmt(t.value)}\n`;
    });
  }
  if (recentCapex.length > 0) {
    text += `\n## PORTFOLIO CAPEX TREND (Last ${recentCapex.length} Months)\n`;
    recentCapex.forEach(t => {
      text += `- ${t.period}: ${fmt(t.value)}\n`;
    });
  }

  // Monthly History for Top CAPEX Spenders
  if (ctx.topCapexStoreHistories && ctx.topCapexStoreHistories.length > 0) {
    text += `\n## HISTORICAL MONTHLY TIMELINES FOR TOP SPENDERS (Last 24 Months)\n`;
    text += `Use this section for Payback Period calculations and for identifying when specific investments occurred.\n`;
    ctx.topCapexStoreHistories.forEach(s => {
      text += `\n### Store: **${s.store}**\n`;
      s.history.slice(-24).forEach(m => {
        text += `- ${m.period} — CAPEX: ${fmt(m.capex)}, EBITDA: ${fmt(m.ebitda)}\n`;
      });
    });
  }

  // All Stores Metrics CSV
  if (ctx.allStoresMetricsCsv) {
    text += `\n## STORE-LEVEL METRICS FOR CURRENT PERIOD (${ctx.periodLabel})\n`;
    text += `Use this CSV table for questions about store-specific margins, costs, or rankings *within the currently filtered period*.\n`;
    text += "```csv\n";
    text += ctx.allStoresMetricsCsv;
    text += "\n```\n";
  }

  return text;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Validate API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Please add OPENAI_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    // Parse request
    const body = await request.json();
    const { messages, filters } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      filters: FilterState;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 });
    }

    // Build analytics context from real data
    const analyticsContext = await buildAnalyticsContext(filters);
    const contextMessage = buildContextMessage(analyticsContext);

    // Build OpenAI messages
    const openai = new OpenAI({ apiKey });
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `## DATA CONTEXT (Ground Truth)\n${contextMessage}` },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: 2000,
      temperature: 0.3,
    });

    const reply = completion.choices[0]?.message?.content || 'I was unable to generate a response. Please try again.';
    const latencyMs = Date.now() - startTime;

    // Log observability metrics
    console.log('[AI Chat]', {
      latencyMs,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
      model: completion.model,
      filterScope: analyticsContext.periodLabel,
    });

    return NextResponse.json({
      reply,
      meta: {
        latencyMs,
        tokens: completion.usage?.total_tokens ?? 0,
        scope: analyticsContext.periodLabel,
      },
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    console.error('[AI Chat Error]', err);

    const message = err instanceof Error ? err.message : 'Unknown error';

    // Differentiate error types
    if (message.includes('API key')) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your OPENAI_API_KEY configuration.' },
        { status: 401 }
      );
    }
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return NextResponse.json(
        { error: 'The analysis timed out. Please try a simpler question or retry.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: `I could not complete that analysis due to a processing error. Please retry. (${latencyMs}ms)` },
      { status: 500 }
    );
  }
}
