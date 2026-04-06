import { SecurityWarningBanner } from '@/features/keys/ui/SecurityWarningBanner';
import { ApiKeysSection } from '@/features/keys/ui/ApiKeysSection';
import { AlertRuleBuilder } from '@/features/alerts/ui/AlertRuleBuilder';
import { TriggerHistory } from '@/features/alerts/ui/TriggerHistory';

export default function KeysAndAlertsPage() {
  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <SecurityWarningBanner />
      <ApiKeysSection />
      
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        <div className="lg:col-span-2">
          <AlertRuleBuilder />
        </div>
        <div>
          <TriggerHistory />
        </div>
      </section>
    </div>
  );
}