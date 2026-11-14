// The pdfjs worker modules ship without type declarations. Tests import the
// legacy worker directly to run pdfjs on the main thread in Node.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs';
