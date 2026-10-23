import type { Category, Expense } from '../types';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ImportedTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  categoryId: string;
  selected: boolean;
  fingerprint: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim()); cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function suggestCategory(description: string, categories: Category[]): string {
  const text = normalize(description);
  const rules: Array<[string[], string[]]> = [
    [['petrol', 'fuel', 'indian oil', 'bharat petroleum', 'hpcl', 'iocl', 'shell', 'pump'], ['fuel']],
    [['swiggy', 'zomato', 'restaurant', 'cafe', 'coffee', 'food', 'dominos', 'pizza', 'mcdonald'], ['food', 'dining']],
    [['grocery', 'groceries', 'bigbasket', 'blinkit', 'zepto', 'dmart', 'supermarket'], ['grocer']],
    [['electricity', 'power bill', 'bescom', 'tneb'], ['electricity']],
    [['water bill', 'water supply'], ['water']],
    [['broadband', 'internet', 'airtel recharge', 'jio recharge'], ['internet']],
    [['pharmacy', 'medical', 'hospital', 'apollo', 'medplus'], ['medical']],
    [['movie', 'cinema', 'netflix', 'spotify', 'bookmyshow'], ['entertain']],
    [['uber', 'ola', 'irctc', 'metro', 'redbus'], ['travel']],
    [['amazon', 'flipkart', 'myntra', 'shopping'], ['shopping']],
  ];
  for (const [needles, categoryTerms] of rules) {
    if (!needles.some((needle) => text.includes(needle))) continue;
    const match = categories.find((category) => categoryTerms.some((term) => normalize(category.name).includes(term)));
    if (match) return match.id;
  }
  return categories.find((category) => /misc/i.test(category.name))?.id ?? categories[0]?.id ?? '';
}

function dateToIso(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const dmy = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  let year: number, month: number, day: number;
  if (iso) [, year, month, day] = iso.map(Number) as [number, number, number, number];
  else if (dmy) {
    const parts = dmy.slice(1).map(Number);
    [day, month, year] = parts;
    if (year < 100) year += year < 70 ? 2000 : 1900;
  } else {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseStatementCsv(text: string, categories: Category[], existing: Expense[]): ImportedTransaction[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('The CSV must include a header and at least one transaction.');
  const headers = rows[0].map(normalize);
  const findColumn = (names: string[]) => headers.findIndex((header) => names.some((name) => header === name || header.includes(name)));
  const dateIndex = findColumn(['date', 'transaction date', 'txn date', 'value date']);
  const descriptionIndex = findColumn(['description', 'narration', 'particular', 'details', 'merchant', 'remarks']);
  const debitIndex = findColumn(['debit', 'withdrawal', 'paid out', 'money out']);
  const amountIndex = findColumn(['amount', 'transaction amount']);
  const creditIndex = findColumn(['credit', 'deposit', 'paid in', 'money in']);
  if (dateIndex < 0 || descriptionIndex < 0 || (debitIndex < 0 && amountIndex < 0)) {
    throw new Error('Could not find date, description, and debit/amount columns. Rename the CSV headers and try again.');
  }
  const existingKeys = new Set(existing.map((expense) => `${expense.date}|${expense.amount}|${normalize(expense.notes || '')}`));
  return rows.slice(1).flatMap((row, index) => {
    const date = dateToIso(row[dateIndex] || '');
    const description = row[descriptionIndex]?.trim() || '';
    const debitRaw = debitIndex >= 0 ? row[debitIndex] : row[amountIndex];
    const creditRaw = creditIndex >= 0 ? row[creditIndex] : '';
    const amount = Number((debitRaw || '').replace(/[₹,\s]/g, ''));
    const credit = Number((creditRaw || '').replace(/[₹,\s]/g, ''));
    if (!date || !description || !Number.isFinite(amount) || amount <= 0 || (Number.isFinite(credit) && credit > 0)) return [];
    const fingerprint = `${date}|${amount}|${normalize(description)}`;
    return [{ id: `row-${index}`, date, amount, description, fingerprint, categoryId: suggestCategory(description, categories), selected: !existingKeys.has(fingerprint) }];
  });
}

export async function parseHdfcStatementPdf(file: File, password: string, categories: Category[], existing: Expense[]): Promise<ImportedTransaction[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data, password }).promise;
  const records: Array<{ date: string; description: string; withdrawal: number }> = [];
  const datePattern = /^\d{2}\/\d{2}\/\d{2,4}$/;
  const money = (value: string) => Number(value.replace(/[₹,\s]/g, ''));

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items.filter((item): item is typeof item & { str: string; transform: number[] } => 'str' in item && Boolean(item.str.trim()));
    const lines: Array<{ y: number; items: Array<{ x: number; text: string }> }> = [];
    for (const item of items) {
      const x = item.transform[4];
      const y = item.transform[5];
      let line = lines.find((candidate) => Math.abs(candidate.y - y) < 1.5);
      if (!line) { line = { y, items: [] }; lines.push(line); }
      line.items.push({ x, text: item.str.trim() });
    }
    lines.sort((a, b) => b.y - a.y);
    let current: { date: string; description: string; withdrawal: number } | null = null;
    const save = () => { if (current?.date && current.description && current.withdrawal > 0) records.push(current); };
    for (const row of lines) {
      const line = row.items;
      line.sort((a, b) => a.x - b.x);
      const dateItem = line.find((item) => item.x < 56 && datePattern.test(item.text));
      if (dateItem) {
        save();
        const [day, month, shortYear] = dateItem.text.split('/').map(Number);
        const year = shortYear < 100 ? (shortYear < 70 ? shortYear + 2000 : shortYear + 1900) : shortYear;
        current = { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, description: '', withdrawal: 0 };
      }
      if (!current) continue;
      const narration = line.filter((item) => item.x >= 65 && item.x < 285 && !datePattern.test(item.text)).map((item) => item.text).join(' ').trim();
      if (narration && !/^(page no|statement of account|account branch|address|city|state|phone no|currency|email|cust id|account no|account type|hdfc bank|joint holders|nomination)/i.test(narration)) {
        current.description = `${current.description} ${narration}`.trim();
      }
      for (const item of line) {
        if (item.x >= 395 && item.x < 490 && /^[\d,]+\.\d{2}$/.test(item.text)) current.withdrawal = money(item.text);
      }
    }
    save();
  }
  if (records.length === 0) throw new Error('No debit transactions were found. Confirm this is an HDFC account statement PDF and try exporting a CSV instead.');
  const existingKeys = new Set(existing.map((expense) => `${expense.date}|${expense.amount}|${normalize(expense.notes || '')}`));
  return records.map((record, index) => {
    const fingerprint = `${record.date}|${record.withdrawal}|${normalize(record.description)}`;
    return { id: `pdf-${index}`, date: record.date, amount: record.withdrawal, description: record.description, categoryId: suggestCategory(record.description, categories), fingerprint, selected: !existingKeys.has(fingerprint) };
  });
}
