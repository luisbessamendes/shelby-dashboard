'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ReportContext as ReportScope } from '@/lib/bi-contract';

const Context = createContext<{ scope: ReportScope; setScope: (scope: ReportScope) => void } | null>(null);

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScope] = useState<ReportScope>({ path: '/overview' });
  const value = useMemo(() => ({ scope, setScope }), [scope]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useReportScope() {
  const context = useContext(Context);
  const path = usePathname() || '/overview';
  return context?.scope.path === path ? context.scope : { path: path === '/' ? '/overview' : path };
}

export function useRegisterReportScope(options: Omit<ReportScope, 'path'>) {
  const context = useContext(Context);
  const setScope = context?.setScope;
  const path = usePathname() || '/overview';
  const serialized = JSON.stringify(options);
  useEffect(() => {
    setScope?.({ path, ...JSON.parse(serialized) });
  }, [path, serialized, setScope]);
}
