import type { ReactNode } from 'react';
import { usGpmToM3PerHour } from '@/calc';
import { fmtMinutes, fmtNumber, fmtValue } from '@/lib/format';
import { TEST_CODE_LABELS, TEST_CODES } from '@/model/options';
import { DEFAULT_RULES, defaultPump } from '@/rules';
import { useSettingsStore } from '@/store/settingsStore';
import { NumberInput, TextInput } from '../ui/NumberInput';
import { Card, CardHeader } from '../ui/Page';
import { RuleStatus } from '../ui/RuleStatus';

/** Label and help on the left, input and status on the right. */
function RuleRow({ label, help, input, status }: { label: string; help: ReactNode; input: ReactNode; status: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-2 border-b border-line px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted">{help}</div>
      </div>
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        {input}
        {status}
      </div>
    </div>
  );
}

const holdText = (minutes: number | null) => (minutes === null ? 'per client' : fmtMinutes(minutes));

export function TestCodeRulesCard() {
  const rules = useSettingsStore((s) => s.rules.testCodes);
  const setRule = useSettingsStore((s) => s.setTestCodeRule);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Test code rules"
        description="Minimum test pressure at the high point is the factor times the design pressure. The hold period is checked against the minimum."
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-xs font-semibold text-muted">
              <th className="py-2.5 pr-4 pl-5">Code</th>
              <th className="px-4 py-2.5">Test factor</th>
              <th className="px-4 py-2.5">Minimum hold</th>
              <th className="px-4 py-2.5">Basis</th>
              <th className="py-2.5 pr-5 pl-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {TEST_CODES.map((code) => {
              const rule = rules[code];
              const def = DEFAULT_RULES.testCodes[code];
              const isDefault = rule.factor === def.factor && rule.minHoldMinutes === def.minHoldMinutes;
              const label = TEST_CODE_LABELS[code];
              const scope = label.startsWith(code) ? label.slice(code.length).trim() : '';
              return (
                <tr key={code} className="border-b border-line align-top last:border-0">
                  <td className="py-3 pr-4 pl-5">
                    <div className="font-medium text-ink">{code}</div>
                    {scope && <div className="text-xs text-muted">{scope}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <NumberInput
                      value={rule.factor}
                      allowEmpty
                      min={0}
                      exclusiveMin
                      suffix="× design"
                      placeholder="Enter"
                      aria-label={`${code} test factor`}
                      className="w-32"
                      onChange={(factor) => setRule(code, { factor })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <NumberInput
                      value={rule.minHoldMinutes}
                      allowEmpty
                      min={0}
                      suffix="min"
                      placeholder="Per client"
                      aria-label={`${code} minimum hold in minutes`}
                      className="w-32"
                      onChange={(minHoldMinutes) => setRule(code, { minHoldMinutes })}
                    />
                    {rule.minHoldMinutes !== null && rule.minHoldMinutes >= 60 && (
                      <div className="mt-1 text-xs text-muted">= {fmtMinutes(rule.minHoldMinutes)}</div>
                    )}
                  </td>
                  <td className="max-w-72 px-4 py-3 text-xs leading-relaxed text-muted">{def.basis}</td>
                  <td className="py-3 pr-5 pl-4">
                    <RuleStatus
                      isDefault={isDefault}
                      missing={rule.factor === null ? 'Enter from client spec' : undefined}
                      defaultText={`${def.factor === null ? 'blank' : `${fmtValue(def.factor)} ×`}, ${holdText(def.minHoldMinutes)}`}
                      onReset={() => setRule(code, { factor: def.factor, minHoldMinutes: def.minHoldMinutes })}
                    />
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

export function PressureRulesCard() {
  const pressure = useSettingsStore((s) => s.rules.pressure);
  const setPressure = useSettingsStore((s) => s.setPressureRules);
  const def = DEFAULT_RULES.pressure;

  return (
    <Card>
      <CardHeader title="Static head and flags" />
      <RuleRow
        label="Static head gradient"
        help="Bar per metre of elevation for the test water. 0.0981 is water at 1000 kg/m³."
        input={
          <NumberInput
            value={pressure.waterGradientBarPerM}
            min={0}
            exclusiveMin
            suffix="bar/m"
            aria-label="Static head gradient"
            className="w-32"
            onChange={(v) => v !== null && setPressure({ waterGradientBarPerM: v })}
          />
        }
        status={
          <RuleStatus
            isDefault={pressure.waterGradientBarPerM === def.waterGradientBarPerM}
            defaultText={fmtValue(def.waterGradientBarPerM)}
            onReset={() => setPressure({ waterGradientBarPerM: def.waterGradientBarPerM })}
          />
        }
      />
      <RuleRow
        label="AMBER band"
        help="AMBER when the low point test pressure is within this percentage of the max allowable. Above the max allowable is RED."
        input={
          <NumberInput
            value={pressure.amberWithinPct}
            min={0}
            suffix="%"
            aria-label="AMBER band percentage"
            className="w-32"
            onChange={(v) => v !== null && setPressure({ amberWithinPct: v })}
          />
        }
        status={
          <RuleStatus
            isDefault={pressure.amberWithinPct === def.amberWithinPct}
            defaultText={`${fmtValue(def.amberWithinPct)}%`}
            onReset={() => setPressure({ amberWithinPct: def.amberWithinPct })}
          />
        }
      />
    </Card>
  );
}

export function NitrogenRulesCard() {
  const nitrogen = useSettingsStore((s) => s.rules.nitrogen);
  const setNitrogen = useSettingsStore((s) => s.setNitrogenRules);
  const def = DEFAULT_RULES.nitrogen;

  return (
    <Card>
      <CardHeader title="Nitrogen defaults" description="Used for every job unless the job sets its own on the Calculations page." />
      <RuleRow
        label="Purge volumes"
        help="Line volumes of nitrogen swept through, at near atmospheric pressure."
        input={
          <NumberInput
            value={nitrogen.purgeVolumes}
            min={0}
            exclusiveMin
            suffix="× V"
            aria-label="Default nitrogen purge volumes"
            className="w-32"
            onChange={(v) => v !== null && setNitrogen({ purgeVolumes: v })}
          />
        }
        status={
          <RuleStatus
            isDefault={nitrogen.purgeVolumes === def.purgeVolumes}
            defaultText={fmtValue(def.purgeVolumes)}
            onReset={() => setNitrogen({ purgeVolumes: def.purgeVolumes })}
          />
        }
      />
      <RuleRow
        label="Packing pressure"
        help="Gauge pressure the line is left packed at for preservation."
        input={
          <NumberInput
            value={nitrogen.packingPressureBarg}
            min={0}
            suffix="barg"
            aria-label="Default nitrogen packing pressure"
            className="w-32"
            onChange={(v) => v !== null && setNitrogen({ packingPressureBarg: v })}
          />
        }
        status={
          <RuleStatus
            isDefault={nitrogen.packingPressureBarg === def.packingPressureBarg}
            defaultText={`${fmtValue(def.packingPressureBarg)} barg`}
            onReset={() => setNitrogen({ packingPressureBarg: def.packingPressureBarg })}
          />
        }
      />
    </Card>
  );
}

export function PumpPresetsCard() {
  const pumps = useSettingsStore((s) => s.rules.pumps);
  const setPump = useSettingsStore((s) => s.setPump);

  return (
    <Card>
      <CardHeader title="Pump presets" description="Rated flows used for fill time. 1 US gallon = 3.78541 L." />
      {pumps.map((pump) => {
        const def = defaultPump(pump.id);
        const isDefault = def !== undefined && pump.name === def.name && pump.ratedUsGpm === def.ratedUsGpm;
        return (
          <RuleRow
            key={pump.id}
            label={pump.name || 'Unnamed pump'}
            help={
              <TextInput
                value={pump.name}
                aria-label="Pump name"
                className="mt-1 w-full max-w-64"
                onChange={(name) => setPump(pump.id, { name })}
              />
            }
            input={
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-muted">
                  = {fmtNumber(usGpmToM3PerHour(pump.ratedUsGpm), 1)} m³/h
                </span>
                <NumberInput
                  value={pump.ratedUsGpm}
                  min={0}
                  exclusiveMin
                  suffix="US gpm"
                  aria-label={`${pump.name} rated flow`}
                  className="w-36"
                  onChange={(v) => v !== null && setPump(pump.id, { ratedUsGpm: v })}
                />
              </div>
            }
            status={
              <RuleStatus
                isDefault={isDefault}
                defaultText={def ? `${def.name}, ${fmtValue(def.ratedUsGpm)} gpm` : undefined}
                onReset={def ? () => setPump(pump.id, { name: def.name, ratedUsGpm: def.ratedUsGpm }) : undefined}
              />
            }
          />
        );
      })}
    </Card>
  );
}
