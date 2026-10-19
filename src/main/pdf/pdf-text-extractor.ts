/**
 * Low-level PDF text extraction using pdfjs-dist, reconstructing visual
 * rows/lines by clustering text items on the Y axis and sorting within
 * each cluster by X — mimics what pdfplumber's `extract_text()` does,
 * which the original Python PDF converters (uangmakan-converter repo)
 * relied on. A naive `pdf-parse` text dump interleaves columns in the
 * wrong order for these tabular government PDFs, so this clustering step
 * is required for the regexes ported from Python to match.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

interface TextItem {
  str: string;
  x: number;
  y: number;
}

/**
 * Y-axis tolerance (in PDF points) for clustering text items into the same
 * visual line. 3pt was tuned against real SAKTI/MyIntress export PDFs
 * (uang makan P3K and honorarium KPA/PPK/PPSPM) where column headers and
 * data cells on the same visual row can differ by 1-2pt due to font
 * baseline differences.
 */
const DEFAULT_Y_TOLERANCE = 3;

export async function extractPdfLines(
  buffer: Buffer,
  yTolerance: number = DEFAULT_Y_TOLERANCE
): Promise<string[]> {
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items: TextItem[] = content.items
      .map((it: any) => ({
        str: String(it.str ?? ''),
        x: it.transform[4],
        y: it.transform[5]
      }))
      .filter((it: TextItem) => it.str.trim() !== '');

    items.sort((a, b) => b.y - a.y);

    interface Cluster {
      y: number;
      items: TextItem[];
    }
    const clusters: Cluster[] = [];
    for (const it of items) {
      let cluster = clusters.find((c) => Math.abs(c.y - it.y) <= yTolerance);
      if (!cluster) {
        cluster = { y: it.y, items: [] };
        clusters.push(cluster);
      }
      cluster.items.push(it);
      cluster.y = (cluster.y * (cluster.items.length - 1) + it.y) / cluster.items.length;
    }

    for (const c of clusters) {
      c.items.sort((a, b) => a.x - b.x);
      const line = c.items
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) lines.push(line);
    }
  }

  return lines;
}

export async function extractPdfText(
  buffer: Buffer,
  yTolerance: number = DEFAULT_Y_TOLERANCE
): Promise<string> {
  const lines = await extractPdfLines(buffer, yTolerance);
  return lines.join('\n');
}
