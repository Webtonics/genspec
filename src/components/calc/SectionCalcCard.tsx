import { CircleAlert, CircleCheck, Clock } from 'lucide-react';
import type { HoldCheck, SectionCalc } from '@/calc';
import { cx } from '@/lib/cx';
import { fmtNumber, fmtValue } from '@/lib/format';
import type { TestSection } from '@/model/types';
import { FLAG_BANNER, FlagChip } from '../ui/FlagChip';
import { Card } from '../ui/Page';
import { ElevationSketch } from './ElevationSketch';
import { InputsList } from './InputsList';
import { sectionAnchor } from './SummaryTable';
import { WorkingPanel } from './WorkingPanel';

function HoldLine({ hold }: { hold: HoldCheck }) {
  const Icon = hold.ok === true ? CircleCheck : hold.ok === false ? CircleAlert : Clock;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Hold period</h3>
      <div
        className={cx(
          'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm',
          hold.ok === false
            ? 'border-amber-300 bg-amber-50 text-amber-900 scada:border-[#FFB020]/40 scada:bg-[#FFB020]/10 scada:text-amber-100'
            : 'border-line bg-surface text-ink',
        )}
      >
        <Icon
          size={16}
          className={cx('mt-0.5 shrink-0', hold.ok === true ? 'text-emerald-600 scada:text-[#00E87B]' : hold.ok === false ? 'text-amber-600' : 'text-muted')}
        />
        {hold.message}
      </div>
    </section>
  );
}

/** Full working for one test section: flag, working panels, elevation sketch and inputs. */
export function SectionCalcCard({ section, calc, isWater }: { section: TestSection; calc: SectionCalc; isWater: boolean }) {
  return (
    <Card className="scroll-mt-6 overflow-hidden">
      <div id={sectionAnchor(section.id)} className="scroll-mt-6" />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-mono text-base font-semibold text-ink">{section.name}</h2>
          <span className="text-sm text-muted">
            NPS {fmtValue(section.nps)} · {fmtNumber(section.lengthM / 1000, 2)} km · design {fmtValue(section.designPressureBarg)} barg
          </span>
        </div>
        <FlagChip flag={calc.flag?.flag ?? null} />
      </header>

      {calc.flag && (
        <p className={cx('border-l-4 px-5 py-3 text-sm font-medium', FLAG_BANNER[calc.flag.flag])}>{calc.flag.message}</p>
      )}

      {calc.issues.length > 0 && (
        <div className="border-b border-line bg-surface-2 px-5 py-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-ink">
            <CircleAlert size={15} className="text-amber-600" />
            Some results could not be calculated
          </div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-9 text-muted">
            {calc.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,430px)]">
        <div className="min-w-0 space-y-5">
          {calc.groups.map((group) => (
            <WorkingPanel key={group.key} group={group} />
          ))}
          {calc.hold && <HoldLine hold={calc.hold} />}
        </div>
        <div className="min-w-0 space-y-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Elevation sketch</h3>
            <ElevationSketch section={section} calc={calc} isWater={isWater} />
          </section>
          <InputsList inputs={calc.inputs} />
        </div>
      </div>
    </Card>
  );
}
