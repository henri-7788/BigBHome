import { AppNav } from '@/components/AppNav';
import { CommuteView } from '@/components/commute/CommuteView';

export default function CommutePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗺️</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-none">Pendel-Heatmap</h1>
              <p className="text-xs text-gray-500 mt-0.5">Wo in Berlin wohnen sich am besten für deine Wege lohnt</p>
            </div>
          </div>
          <AppNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <CommuteView />
      </main>
    </div>
  );
}
