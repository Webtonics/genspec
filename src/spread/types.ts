export type TemplateKey = 'flooding' | 'nitrogen' | 'dewatering';

/** Items that sit on the process line, left to right in flow order. */
export type NodeKind =
  | 'tank'
  | 'pump'
  | 'testPump'
  | 'compressor'
  | 'n2unit'
  | 'gate'
  | 'ball'
  | 'globe'
  | 'check'
  | 'flowmeter'
  | 'injection'
  | 'launcher'
  | 'receiver'
  | 'section'
  | 'outlet'
  | 'ventStack';

/** Things mounted above a node: instruments, relief valves, vents. */
export type Attachment =
  | { kind: 'instrument'; letters: string; number: string }
  | { kind: 'relief'; tag: string; note: string }
  | { kind: 'vent'; tag: string };

export type SpreadNode = {
  id: string;
  kind: NodeKind;
  /** Label lines under the symbol. The first is the tag, drawn bold. */
  lines: string[];
  /** Text drawn inside the symbol (test section, off-page connector). */
  inside?: string[];
  above?: Attachment[];
};

/** A generated spread: what to draw, before layout. */
export type SpreadSpec = {
  template: TemplateKey;
  title: string;
  subtitle: string;
  drawingNo: string;
  main: SpreadNode[];
  /** A second line (e.g. the hydrotest pump) that tees into the main line before node connectTo. */
  lower?: { connectTo: string; nodes: SpreadNode[] };
  notes: string[];
};
