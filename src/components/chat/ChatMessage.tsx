'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { EvidenceSource } from '@/lib/chat-runtime';

const sourceNames: Record<string, string> = {
  get_metric_definitions: 'Metric definitions', query_metrics: 'Dashboard calculations', get_time_series: 'Trend calculations',
  get_pnl_report: 'Historical P&L', get_perimeter_report: 'L4L / Perimeter and store register', get_store_evidence: 'Monthly source records',
  get_profit_bridge: 'Profit waterfall', get_store_benchmarks: 'Store benchmarks', get_data_quality: 'Data quality checks', get_upload_history: 'Upload history',
};

export default function ChatMessage({ role, content, sources = [] }: { role: 'user' | 'assistant'; content: string; sources?: EvidenceSource[] }) {
  return <div className={`chat-message chat-message-${role}`}>
    <div className={`chat-bubble chat-bubble-${role}`}>
      {role === 'assistant' ? <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
        table: ({ children }) => <div className="chat-table-scroll"><table>{children}</table></div>,
        a: ({ children }) => <span>{children}</span>,
        img: ({ alt }) => <span>{alt}</span>,
      }}>{content}</Markdown> : <p>{content}</p>}
      {sources.length > 0 && <details className="chat-sources">
        <summary>Sources ({sources.length})</summary>
        {sources.map(source => <div key={source.id} className="chat-source">
          <strong>[{source.id}] {sourceNames[source.tool] ?? 'Dashboard evidence'}</strong>
          <div>{source.period}{source.records == null ? '' : ` | ${source.records} records`}</div>
          {source.warnings.map(warning => <div key={warning} className="chat-source-warning">{warning}</div>)}
        </div>)}
      </details>}
    </div>
  </div>;
}
