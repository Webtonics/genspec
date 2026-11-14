import type { JobCalc } from '@/calc';
import { fmtHours, fmtNumber } from '@/lib/format';
import type { Job } from '@/model/types';
import { FlagChip } from '../ui/FlagChip';
import { Card, CardHeader } from '../ui/Page';

const num = (value: number | undefined, decimals: number) => (value === undefined ? 'n/a' : fmtNumber(value, decimals));

export function sectionAnchor(sectionId: string) {
  return `calc-${sectionId}`;
}

/** One row per test section with the headline results and flag. Rows jump to the full working. */
export function SummaryTable({ job, calc }: { job: Job; calc: JobCalc }) {
  const pumpName = calc.options.pump?.name ?? 'pump';
  const isWater = job.medium === 'inhibited water';

  const headers: { label: string; unit?: string }[] = [
    { label: 'Section' },
    { label: 'Length', unit: 'km' },
    { label: 'Volume', unit: 'm³' },
    ...(isWater ? [{ label: 'Fill time', unit: pumpName }] : []),
    { label: 'P(HP)', unit: 'barg' },
    { label: 'P(LP)', unit: 'barg' },
    { label: 'Max allowable', unit: 'barg' },
    { label: 'Margin', unit: 'bar' },
    { label: 'Flag' },
  ];

  return (
    <Card className="overflow-hidden" data-tour="calc-summary">
      <CardHeader title="Summary" description="Select a section to jump to its full working." />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              {headers.map((h, i) => (
                <th
                  key={h.label}
                  className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-muted first:pl-5 last:pr-5 ${i === 0 ? 'text-left' : i === headers.length - 1 ? 'text-center' : 'text-right'}`}
                >
                  {h.label}
                  {h.unit && <span className="ml-1 font-normal">({h.unit})</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {job.sections.map((section, i) => {
              const result = calc.sections[i];
              const v = result.values;
              return (
                <tr key={section.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="py-2.5 pr-4 pl-5">
                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById(sectionAnchor(section.id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                      className="cursor-pointer font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      {section.name}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtNumber(section.lengthM / 1000, 2)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(v.volumeM3, 1)}</td>
                  {isWater && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      {v.fillTimeHours === undefined ? 'n/a' : fmtHours(v.fillTimeHours)}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(v.highPointBarg, 2)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{num(v.lowPointBarg, 2)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtNumber(section.maxAllowableTestBarg, 2)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(result.flag?.marginBar, 2)}</td>
                  <td className="py-2.5 pr-5 pl-4 text-center">
                    <FlagChip flag={result.flag?.flag ?? null} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
