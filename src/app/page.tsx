import { ListingsView } from '@/components/ListingsView';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">🏠</span>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">WG Route Finder</h1>
            <p className="text-xs text-gray-500 mt-0.5">Fahrtzeit zur Arbeit für WG-Inserate berechnen</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ListingsView />
      </main>
    </div>
  );
}
