import type { AttachmentColumn, AttachmentItem } from '../types/document';

const BULAN_INDONESIA = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const ROMAN_MONTHS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

export function formatTanggalIndonesia(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = Number(parts[0]);
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (!year || monthIdx < 0 || monthIdx > 11 || !day) return isoDate;
  return `${day} ${BULAN_INDONESIA[monthIdx]} ${year}`;
}

export function toRomanMonth(isoDate: string): string {
  const parts = isoDate.split('-');
  const monthIdx = parts.length === 3 ? Number(parts[1]) - 1 : new Date().getMonth();
  return ROMAN_MONTHS[Math.max(0, Math.min(11, monthIdx))] || 'I';
}

export function formatLetterNumber(
  pattern: string,
  sequence: number,
  code: string,
  unitCode: string,
  isoDate: string
): string {
  const year = isoDate ? Number(isoDate.split('-')[0]) || new Date().getFullYear() : new Date().getFullYear();
  const paddedSeq = String(Math.max(1, sequence)).padStart(3, '0');
  const romanMonth = toRomanMonth(isoDate);
  return pattern
    .replace(/\{seq\}/g, paddedSeq)
    .replace(/\{code\}/g, code.toUpperCase())
    .replace(/\{unit\}/g, (unitCode || 'SEK').toUpperCase())
    .replace(/\{roman_month\}/g, romanMonth)
    .replace(/\{year\}/g, String(year));
}

export function renderTemplateString(
  templateText: string,
  values: Record<string, string>
): string {
  if (!templateText) return '';
  return templateText.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const val = values[key];
    if (val === undefined || val === '') {
      return `[${key}]`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return formatTanggalIndonesia(val);
    }
    return val;
  });
}

export function extractTemplateVariables(texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    const matches = text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
    for (const m of matches) {
      if (m[1]) found.add(m[1]);
    }
  }
  return Array.from(found);
}

export function formatRupiah(rawValue: string | number): string {
  const num = typeof rawValue === 'number' ? rawValue : Number(String(rawValue).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(num)) return String(rawValue || '');
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function parseNumericValue(rawValue: string | number): number {
  if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : 0;
  const cleaned = String(rawValue || '').replace(/[^\d.-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function computeAttachmentTotal(attachment: AttachmentItem): number {
  if (!attachment.showSummaryRow || !attachment.summaryColumnKey) return 0;
  const key = attachment.summaryColumnKey;
  return attachment.rows.reduce((sum, row) => sum + parseNumericValue(row[key] ?? ''), 0);
}

export function parseDelimitedRows(
  rawText: string,
  columns: AttachmentColumn[]
): Record<string, string>[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0 || columns.length === 0) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const parsed: Record<string, string>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    // Skip header row if it matches first column label
    if (i === 0 && cells[0]?.toLowerCase() === columns[0]?.label.toLowerCase()) {
      continue;
    }
    const row: Record<string, string> = {};
    columns.forEach((col, idx) => {
      row[col.key] = cells[idx] ?? '';
    });
    parsed.push(row);
  }
  return parsed;
}

export function toRomanIndex(num: number): string {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return romans[num - 1] || String(num);
}

export function exportHtmlToWordDoc(containerElement: HTMLElement | null, fileName: string): boolean {
  if (!containerElement) return false;
  const clone = containerElement.cloneNode(true) as HTMLElement;

  const htmlDocument = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>${fileName}</title>
        <style>
          @page { size: A4 portrait; margin: 20mm 22mm 20mm 25mm; }
          body { font-family: "Times New Roman", serif; font-size: 11pt; color: #111827; line-height: 1.5; }
          table { border-collapse: collapse; width: 100%; }
          .a4-sheet { page-break-after: always; }
          .a4-sheet:last-child { page-break-after: auto; }
        </style>
      </head>
      <body>${clone.innerHTML}</body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlDocument], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName.replace(/[^\w\-.]+/g, '_')}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}
