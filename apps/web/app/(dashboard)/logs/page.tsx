import { LogsHeader } from '@/features/logs/ui/LogsHeader';
import { LogsFilterBar } from '@/features/logs/ui/LogsFilterBar';
import { LogsTable } from '@/features/logs/ui/LogsTable';
import { LogsInsights } from '@/features/logs/ui/LogsInsights';

export default function LogsPage() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto w-full space-y-6">
      <LogsHeader />
      <LogsFilterBar />
      <LogsTable />
      <LogsInsights />
    </div>
  );
}