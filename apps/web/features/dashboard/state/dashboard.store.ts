import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type DashboardTimeframe = '1h' | '6h' | '24h' | '7d';

interface DashboardState {
  timeframe: DashboardTimeframe;
  setTimeframe: (timeframe: DashboardTimeframe) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      timeframe: '24h',
      setTimeframe: (timeframe) => set({ timeframe }),
    }),
    {
      name: 'persistroot-dashboard',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ timeframe: state.timeframe }),
    }
  )
);
