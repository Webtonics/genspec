import { RotateCcw } from 'lucide-react';
import { NitrogenRulesCard, PressureRulesCard, PumpPresetsCard, TestCodeRulesCard } from '@/components/settings/RuleCards';
import { TitleBlockCard } from '@/components/settings/TitleBlockCard';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Page, PageHeader } from '@/components/ui/Page';
import { plural } from '@/lib/format';
import { DEFAULT_RULES, RULE_DEFAULT_LABEL } from '@/rules';
import { useJobStore } from '@/store/jobStore';
import { useSettingsStore } from '@/store/settingsStore';

export function SettingsPage() {
  const jobCount = useJobStore((s) => s.jobs.length);
  const resetDemoData = useJobStore((s) => s.resetDemoData);
  const rules = useSettingsStore((s) => s.rules);
  const resetRules = useSettingsStore((s) => s.resetRules);
  const rulesAreDefault = JSON.stringify(rules) === JSON.stringify(DEFAULT_RULES);

  const confirmResetRules = () => {
    if (window.confirm('Reset every rule table and pump preset to the shipped defaults?')) resetRules();
  };
  const confirmResetDemo = () => {
    if (window.confirm('Restore the two demo jobs? This replaces every job stored in this browser.')) resetDemoData();
  };

  return (
    <Page>
      <PageHeader
        title="Settings"
        description={`Rule tables and presets behind every calculation. Values marked "${RULE_DEFAULT_LABEL}" are shipped defaults for an engineer to confirm before use.`}
        actions={
          <Button onClick={confirmResetRules} disabled={rulesAreDefault}>
            <RotateCcw size={15} />
            Reset rules to defaults
          </Button>
        }
      />
      <div className="space-y-6">
        <TestCodeRulesCard />
        <div className="grid gap-6 lg:grid-cols-2">
          <PressureRulesCard />
          <NitrogenRulesCard />
        </div>
        <PumpPresetsCard />
        <TitleBlockCard />
        <Card>
          <CardHeader
            title="Demo data"
            description={`Jobs are stored in this browser only (${plural(jobCount, 'job')} saved). Restore the seeded demo jobs before a walkthrough.`}
            actions={
              <Button onClick={confirmResetDemo}>
                <RotateCcw size={15} />
                Restore demo jobs
              </Button>
            }
          />
        </Card>
      </div>
    </Page>
  );
}
