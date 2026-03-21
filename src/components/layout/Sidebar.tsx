'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';

const ICONS: Record<string, string> = {
  dashboard: '📊',
  table: '📋',
  segments: '🏷️',
  trending: '📈',
  diagnostics: '🔬',
  rankings: '🏆',
  investment: '💼',
  upload: '📤',
};

export default function Sidebar() {
  const pathname = usePathname();

  // Separate main nav items from upload
  const mainItems = NAV_ITEMS.filter(i => i.icon !== 'upload');
  const uploadItem = NAV_ITEMS.find(i => i.icon === 'upload')!;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">Shelby Dashboard</div>
        <div className="sidebar-subtitle">Performance Analytics</div>
      </div>

      <nav className="sidebar-nav">
        {mainItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{ICONS[item.icon]}</span>
              <span>{item.label}</span>
              {'phase2' in item && item.phase2 && (
                <span className="nav-phase2-badge">Soon</span>
              )}
            </Link>
          );
        })}

        <div className="nav-divider" />

        <Link
          href={uploadItem.href}
          className={`nav-item${pathname === uploadItem.href ? ' active' : ''}`}
        >
          <span className="nav-icon">{ICONS[uploadItem.icon]}</span>
          <span>{uploadItem.label}</span>
        </Link>
      </nav>
    </aside>
  );
}
