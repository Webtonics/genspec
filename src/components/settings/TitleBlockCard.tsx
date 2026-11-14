import { DEFAULT_TITLE_BLOCK, documentNumber } from '@/rules/titleBlock';
import { useSettingsStore } from '@/store/settingsStore';
import { TextInput } from '../ui/NumberInput';
import { Card, CardHeader } from '../ui/Page';
import { RuleStatus } from '../ui/RuleStatus';

/** Company and document numbering used in every generated title block. */
export function TitleBlockCard() {
  const tb = useSettingsStore((s) => s.titleBlock);
  const set = useSettingsStore((s) => s.setTitleBlock);
  const d = DEFAULT_TITLE_BLOCK;

  const row = (label: string, help: string, key: keyof typeof tb, width = 'w-72') => (
    <div className="grid gap-x-6 gap-y-2 border-b border-line px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted">{help}</div>
      </div>
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <TextInput value={tb[key]} aria-label={label} className={width} onChange={(v) => set({ [key]: v })} />
        <RuleStatus isDefault={tb[key] === d[key]} defaultText={d[key]} onReset={() => set({ [key]: d[key] })} />
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader title="Title block" description="Shown on every generated document: test pack pages and spread diagrams." />
      {row('Company', 'Name in the title block and on the test pack cover.', 'company', 'w-48')}
      {row('Tagline', 'Short line under the company name.', 'tagline')}
      {row(
        'Document number format',
        `Tokens: {job} job number, {type} document type (TP test pack, SPD spread), {nn} sequence. Gives ${documentNumber(tb.documentFormat, 'GPPSL-26-0412', 'TP', 1)}.`,
        'documentFormat',
      )}
    </Card>
  );
}
