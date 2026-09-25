import 'leaflet/dist/leaflet.css';
import './globals.css';
import Navbar from '../components/nav/Navbar';
import { I18nProvider } from '../lib/i18n';

export const metadata = {
  title: 'MargSetu (मार्गसेतु) — Resilient Logistics & Emergency Accessibility Intelligence',
  description: 'NDMA Lifeline Corridor Decision Support & Disaster Resilience System (SIH 2026 / SIH26002 - MDoNER & NDMA). Notice: SIMULATION — not connected to official NDMA systems.',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport = {
  themeColor: '#FAF8F5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased selection:bg-brand selection:text-white">
        <I18nProvider>
          <div className="relative min-h-screen flex flex-col ndma-watermark">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
