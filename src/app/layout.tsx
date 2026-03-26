import type { Metadata } from 'next';
import './globals.css';
import { FilterProvider } from '@/contexts/FilterContext';
import Sidebar from '@/components/layout/Sidebar';
import FilterBar from '@/components/layout/FilterBar';
import ChatLauncher from '@/components/chat/ChatLauncher';

export const metadata: Metadata = {
  title: 'Shelby Dashboard — Multi-Brand Performance Analytics',
  description: 'Investor-grade operating dashboard for a multi-brand QSF restaurant platform. Portfolio diagnosis, store comparison, trend analysis, and investment judgment.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <FilterProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              <FilterBar />
              <div className="page-wrapper">
                {children}
              </div>
            </main>
          </div>
          <ChatLauncher />
        </FilterProvider>
      </body>
    </html>
  );
}
