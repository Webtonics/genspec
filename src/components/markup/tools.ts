import { MARKUP_TYPE_LABELS } from '@/model/options';
import type { Tool } from './studioStore';

export type ToolDef = { tool: Tool; label: string; short: string; key: string; hint: string };

const label = (tool: Tool) => (tool === 'select' ? 'Select' : tool === 'pan' ? 'Pan' : MARKUP_TYPE_LABELS[tool]);

const def = (tool: Tool, short: string, key: string, hint: string): ToolDef => ({ tool, label: label(tool), short, key, hint });

/** Toolbar groups, in order. Keys are single-letter shortcuts. */
export const TOOL_GROUPS: ToolDef[][] = [
  [
    def('select', 'Select', 'V', 'Click a markup to select it, drag to move it. Delete removes it.'),
    def('pan', 'Pan', 'H', 'Drag to pan. Hold Space to pan with any tool. Ctrl and scroll to zoom.'),
  ],
  [
    def('boundary', 'Boundary', 'L', 'Click around the test limit to add points. Double-click or Enter to finish, Esc to cancel.'),
    def('purgeRoute', 'Purge', 'P', 'Click along the purge route in flow order. Double-click or Enter to finish, Esc to cancel.'),
  ],
  [
    def('blind', 'Blind', 'B', 'Click on the line to place a spectacle blind.'),
    def('vent', 'Vent', 'E', 'Click on the line to place a vent.'),
    def('drain', 'Drain', 'D', 'Click on the line to place a drain.'),
    def('fill', 'Fill', 'F', 'Click where the fill hose connects.'),
    def(
      'valve',
      'Valve',
      'X',
      'Click a valve on the drawing to mark it: its tag is read from the drawing. Click a marked valve to toggle open or closed.',
    ),
    def('joint', 'Joint', 'J', 'Click on a flanged joint to add it to the joint register.'),
  ],
  [
    def('gauge', 'Gauge', 'G', 'Click where a temporary pressure gauge connects.'),
    def('recorder', 'Recorder', 'C', 'Click where a temporary pressure recorder connects.'),
  ],
];

export const TOOLS: ToolDef[] = TOOL_GROUPS.flat();

export const TOOL_BY_KEY: Record<string, Tool> = Object.fromEntries(TOOLS.map((t) => [t.key, t.tool]));

export const toolDef = (tool: Tool) => TOOLS.find((t) => t.tool === tool) ?? TOOLS[0];
