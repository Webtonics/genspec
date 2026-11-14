import { SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { JobCalc } from '@/calc';
import { usGpmToM3PerHour } from '@/calc';
import { fmtMinutes, fmtNumber, fmtValue } from '@/lib/format';
import { MEDIUM_LABELS } from '@/model/options';
import type { Job, JobCalcOptions } from '@/model/types';
import { DEFAULT_RULES } from '@/rules';
import { useJobStore } from '@/store/jobStore';
import { useRules } from '@/store/settingsStore';
import { buttonClass } from '../ui/Button';
import { NumberInput } from '../ui/NumberInput';
import { Card, CardHeader } from '../ui/Page';
import { RuleStatus } from '../ui/RuleStatus';

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-5 py-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      {children}
    </div>
  );
}

function OptionSource({ fromDefault, defaultValue, onReset }: { fromDefault: boolean; defaultValue: string; onReset: () => void }) {
  return fromDefault ? (
    <span className="text-[11px] text-muted">Settings default</span>
  ) : (
    <button type="button" onClick={onReset} className="cursor-pointer text-[11px] font-medium text-primary hover:underline">
      Use default ({defaultValue})
    </button>
  );
}

/** The rules and per-job choices behind every result on the page. */
export function CalcBasisCard({ job, calc }: { job: Job; calc: JobCalc }) {
  const rules = useRules();
  const updateJob = useJobStore((s) => s.updateJob);
  const codeRule = rules.testCodes[job.code];
  const codeDefault = DEFAULT_RULES.testCodes[job.code];
  const isWater = job.medium === 'inhibited water';
  const { options } = calc;

  const setOption = (patch: JobCalcOptions) => updateJob(job.id, { calcOptions: { ...job.calcOptions, ...patch } });

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Calculation basis"
        description="Rule values come from the Settings rule tables. Pump and nitrogen choices apply to this job only."
        actions={
          <Link to="/settings" className={buttonClass('secondary', 'sm')}>
            <SlidersHorizontal size={14} />
            Edit rules
          </Link>
        }
      />
      <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
        <Cell label="Test code">
          <div className="text-sm font-semibold text-ink">{job.code}</div>
          <div className="mt-0.5 text-sm text-muted">
            {codeRule.factor !== null ? `k = ${fmtValue(codeRule.factor)} × design` : 'Factor not entered'}
            {', hold '}
            {codeRule.minHoldMinutes !== null ? fmtMinutes(codeRule.minHoldMinutes) : 'per client'}
          </div>
          <div className="mt-2">
            <RuleStatus
              isDefault={codeRule.factor === codeDefault.factor && codeRule.minHoldMinutes === codeDefault.minHoldMinutes}
              missing={codeRule.factor === null ? 'Enter factor in Settings' : undefined}
            />
          </div>
        </Cell>

        <Cell label="Medium">
          <div className="text-sm font-semibold text-ink">{MEDIUM_LABELS[job.medium]}</div>
          <div className="mt-0.5 text-sm text-muted">
            {isWater
              ? `Static head ${fmtValue(rules.pressure.waterGradientBarPerM)} bar/m`
              : 'Gas filled: static head negligible'}
          </div>
          <div className="mt-0.5 text-sm text-muted">AMBER within {fmtValue(rules.pressure.amberWithinPct)}% of max allowable</div>
        </Cell>

        <Cell label="Fill pump">
          {isWater ? (
            <>
              <select
                value={options.pump?.id ?? ''}
                onChange={(e) => setOption({ pumpId: e.target.value })}
                aria-label="Pump used for fill time"
                className="h-8 w-full cursor-pointer rounded-md border border-line bg-surface px-2 text-sm text-ink outline-none hover:border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {rules.pumps.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {options.pump && (
                <div className="mt-1.5 text-sm text-muted">
                  {fmtValue(options.pump.ratedUsGpm)} US gpm = {fmtNumber(usGpmToM3PerHour(options.pump.ratedUsGpm), 1)} m³/h
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted">Not used: this job is gas filled, so there is no flooding step.</div>
          )}
        </Cell>

        <Cell label="Nitrogen">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink">Purge volumes</span>
              <NumberInput
                value={options.purgeVolumes}
                min={0}
                exclusiveMin
                suffix="× V"
                aria-label="Nitrogen purge volumes"
                className="w-24"
                onChange={(value) => value !== null && setOption({ purgeVolumes: value })}
              />
            </div>
            <div className="-mt-1.5 text-right">
              <OptionSource
                fromDefault={options.fromDefaults.purgeVolumes}
                defaultValue={fmtValue(rules.nitrogen.purgeVolumes)}
                onReset={() => setOption({ purgeVolumes: undefined })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink">Packing pressure</span>
              <NumberInput
                value={options.packingPressureBarg}
                min={0}
                suffix="barg"
                aria-label="Nitrogen packing pressure"
                className="w-24"
                onChange={(value) => value !== null && setOption({ packingPressureBarg: value })}
              />
            </div>
            <div className="-mt-1.5 text-right">
              <OptionSource
                fromDefault={options.fromDefaults.packingPressureBarg}
                defaultValue={`${fmtValue(rules.nitrogen.packingPressureBarg)} barg`}
                onReset={() => setOption({ packingPressureBarg: undefined })}
              />
            </div>
          </div>
        </Cell>
      </div>
    </Card>
  );
}
