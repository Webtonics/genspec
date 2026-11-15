/**
 * Shapes exchanged with the AI endpoints. Pure types, shared by the browser app
 * and the /api functions.
 *
 * The model only reads and extracts: quantities come back as the number and the
 * unit exactly as written. The app converts units in tested code.
 */

export type PressureUnit = 'barg' | 'bar' | 'psig' | 'psi' | 'kPa' | 'MPa';
export type LengthUnit = 'm' | 'km' | 'ft' | 'mi';
export type SizeUnit = 'mm' | 'in';
export type ElevationUnit = 'm' | 'ft';
export type DurationUnit = 'h' | 'min';

export type Quantity<U extends string = string> = { value: number; unit: U } | null;

export type SectionExtraction = {
  name: string | null;
  /** Nominal pipe size, inches. */
  nps: number | null;
  od: Quantity<SizeUnit>;
  wt: Quantity<SizeUnit>;
  length: Quantity<LengthUnit>;
  designPressure: Quantity<PressureUnit>;
  maxAllowableTest: Quantity<PressureUnit>;
  highPointElevation: Quantity<ElevationUnit>;
  lowPointElevation: Quantity<ElevationUnit>;
  hold: Quantity<DurationUnit>;
};

/** What the model read from a plain-English job description. */
export type JobExtraction = {
  title: string | null;
  client: string | null;
  jobNo: string | null;
  medium: 'inhibited water' | 'nitrogen' | 'air' | null;
  code: 'ASME B31.3' | 'ASME B31.4' | 'ASME B31.8' | 'Client spec' | null;
  sections: SectionExtraction[];
  /** Anything ambiguous, or deliberately left out. */
  notes: string[];
};

export type ValveKind = 'gate' | 'ball' | 'globe' | 'check' | 'relief' | 'control' | 'other';

export type SuggestionAction = 'boundary' | 'blind' | 'vent' | 'drain' | 'fill' | 'gauge' | 'recorder' | 'valve';

/** What the model read from a P&ID page. */
export type DrawingRegister = {
  drawing: { number: string | null; title: string | null; revision: string | null; client: string | null };
  lines: { tag: string; size: string | null; service: string | null }[];
  equipment: { tag: string; kind: string; description: string | null }[];
  valves: { tag: string; kind: ValveKind; normallyClosed: boolean | null; description: string | null }[];
  instruments: { tag: string; kind: string; description: string | null }[];
  designData: {
    lineTag: string | null;
    designCode: string | null;
    pipeOd: Quantity<SizeUnit>;
    wallThickness: Quantity<SizeUnit>;
    length: Quantity<LengthUnit>;
    designPressure: Quantity<PressureUnit>;
    highPointElevation: Quantity<ElevationUnit>;
    lowPointElevation: Quantity<ElevationUnit>;
  };
  /** Proposed test limits and connections, each tied to a tag on the drawing. */
  suggestions: { action: SuggestionAction; nearTag: string | null; reason: string }[];
  /** Unreadable areas, assumptions, caveats. */
  notes: string[];
};

export type AiStatus = { enabled: boolean; model: string | null; accessCode: boolean };

export type ParseJobRequest = { text: string };
export type ParseJobResponse = { extraction: JobExtraction; model: string };

export type PageImage = {
  /** What the image shows, e.g. "Whole sheet" or "Top left quarter, zoomed". */
  label: string;
  /** JPEG, PNG or WebP data URL. */
  url: string;
};

export type ReadDrawingRequest = {
  /** The whole page first, then zoomed parts of it (sent for scans, where text is small in the overview). */
  images: PageImage[];
  /** Text found in the PDF with positions in page points, if the PDF has a text layer. */
  texts: { str: string; x: number; y: number }[];
  page: { width: number; height: number };
  context: { medium: string; code: string; sections: string[] };
};
export type ReadDrawingResponse = { register: DrawingRegister; model: string };

export type AiErrorResponse = { error: string };
