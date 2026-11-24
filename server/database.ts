import fs from 'node:fs';
import path from 'node:path';
import type {
  DatabaseSnapshot,
  GeneratedLetter,
  KopSuratProfile,
  LetterTemplate,
} from '../src/types/document.ts';
import { INITIAL_SEED_DATA } from './seedData.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

function ensureDbFile(): DatabaseSnapshot {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_SEED_DATA, null, 2), 'utf-8');
    return structuredClone(INITIAL_SEED_DATA);
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSnapshot>;
    return {
      templates: Array.isArray(parsed.templates) ? parsed.templates : INITIAL_SEED_DATA.templates,
      kopProfiles: Array.isArray(parsed.kopProfiles) ? parsed.kopProfiles : INITIAL_SEED_DATA.kopProfiles,
      letters: Array.isArray(parsed.letters) ? parsed.letters : INITIAL_SEED_DATA.letters,
      sequences: parsed.sequences && typeof parsed.sequences === 'object' ? parsed.sequences : INITIAL_SEED_DATA.sequences,
    };
  } catch {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_SEED_DATA, null, 2), 'utf-8');
    return structuredClone(INITIAL_SEED_DATA);
  }
}

function saveDb(snapshot: DatabaseSnapshot): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(snapshot, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

export function getBootstrapData(): DatabaseSnapshot {
  return ensureDbFile();
}

export function upsertTemplate(template: LetterTemplate): LetterTemplate {
  const db = ensureDbFile();
  const now = new Date().toISOString();
  const nextTemplate: LetterTemplate = { ...template, updatedAt: now };
  const idx = db.templates.findIndex((t) => t.id === nextTemplate.id);
  if (idx >= 0) {
    db.templates[idx] = nextTemplate;
  } else {
    db.templates.unshift(nextTemplate);
  }
  saveDb(db);
  return nextTemplate;
}

export function removeTemplate(id: string): boolean {
  const db = ensureDbFile();
  const before = db.templates.length;
  db.templates = db.templates.filter((t) => t.id !== id);
  if (db.templates.length === before) return false;
  saveDb(db);
  return true;
}

export function upsertKopProfile(profile: KopSuratProfile): KopSuratProfile {
  const db = ensureDbFile();
  const idx = db.kopProfiles.findIndex((k) => k.id === profile.id);
  if (idx >= 0) {
    db.kopProfiles[idx] = profile;
  } else {
    db.kopProfiles.push(profile);
  }
  saveDb(db);
  return profile;
}

export function removeKopProfile(id: string): boolean {
  const db = ensureDbFile();
  if (db.kopProfiles.length <= 1) return false;
  const before = db.kopProfiles.length;
  db.kopProfiles = db.kopProfiles.filter((k) => k.id !== id);
  if (db.kopProfiles.length === before) return false;
  saveDb(db);
  return true;
}

export function peekNextSequence(templateId: string, year: number): number {
  const db = ensureDbFile();
  const key = `${templateId}:${year}`;
  return (db.sequences[key] ?? 0) + 1;
}

export function saveGeneratedLetter(
  letter: GeneratedLetter,
  incrementSequenceYear?: number
): { letter: GeneratedLetter; sequences: Record<string, number> } {
  const db = ensureDbFile();
  const idx = db.letters.findIndex((l) => l.id === letter.id);
  if (idx >= 0) {
    db.letters[idx] = letter;
  } else {
    db.letters.unshift(letter);
    if (incrementSequenceYear) {
      const key = `${letter.templateId}:${incrementSequenceYear}`;
      db.sequences[key] = (db.sequences[key] ?? 0) + 1;
    }
  }
  saveDb(db);
  return { letter, sequences: db.sequences };
}

export function saveBatchLetters(
  letters: GeneratedLetter[],
  templateId: string,
  year: number
): { letters: GeneratedLetter[]; sequences: Record<string, number> } {
  const db = ensureDbFile();
  const key = `${templateId}:${year}`;
  db.sequences[key] = (db.sequences[key] ?? 0) + letters.length;
  for (let i = letters.length - 1; i >= 0; i--) {
    db.letters.unshift(letters[i]);
  }
  saveDb(db);
  return { letters, sequences: db.sequences };
}

export function removeGeneratedLetter(id: string): boolean {
  const db = ensureDbFile();
  const before = db.letters.length;
  db.letters = db.letters.filter((l) => l.id !== id);
  if (db.letters.length === before) return false;
  saveDb(db);
  return true;
}
