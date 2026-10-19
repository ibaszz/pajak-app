/**
 * Resolve a plain name string (as printed on the Honorarium PDF — which has
 * no NIP at all, only "Nama" + "Jabatan" + "Pangkat") against the pajak-app
 * master pegawai list by name. The PDF names commonly include academic
 * titles/degrees ("Dr. Taat Setiawan", "Harris Andriyanto, S.T.",
 * "Ida Bagus Aditya Suryawan, S.Kom") and sometimes middle initials
 * ("Iman K. Sinulingga") that the master data's plain name does not have,
 * so exact string equality is not reliable — hence fuzzy matching.
 */
import type { Pegawai } from '@shared/types';

const TITLE_PREFIXES = new Set(['dr', 'drs', 'ir', 'prof', 'h', 'hj', 'kh', 'kyai']);

/**
 * Strips academic degree suffixes (anything after the first comma — degrees
 * are conventionally appended there, e.g. ", S.T.", ", S.Kom", ", M.M."),
 * leading titles (Dr., Drs., Ir., ...), and single-letter middle initials
 * (e.g. "K." in "Iman K. Sinulingga"), then lowercases and collapses
 * whitespace. Returns both the cleaned full string and its token list for
 * similarity scoring.
 */
export function normalizeName(raw: string): { normalized: string; tokens: string[] } {
  let s = raw.split(',')[0]; // drop degree suffix after comma
  s = s.replace(/[^A-Za-z.\s]/g, ' '); // drop stray punctuation, keep dots for initials
  const rawTokens = s.trim().split(/\s+/).filter(Boolean);

  const tokens: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    let t = rawTokens[i].replace(/\.+$/, ''); // "K." -> "K"
    const lower = t.toLowerCase();
    if (i === 0 && TITLE_PREFIXES.has(lower)) continue; // leading title
    if (t.length <= 1) continue; // single-letter initial, not useful for matching
    tokens.push(lower);
  }

  return { normalized: tokens.join(' '), tokens };
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersect = 0;
  for (const t of setA) if (setB.has(t)) intersect++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersect / union;
}

export interface NameScore {
  pegawai: Pegawai;
  score: number;
}

const MATCH_THRESHOLD = 0.82;
const AMBIGUOUS_GAP = 0.05;

export interface MatchResult {
  status: 'matched' | 'ambiguous' | 'unmatched';
  pegawai: Pegawai | null;
  /** Ranked candidates (best first), always returned so the UI can offer a manual picker. */
  candidates: NameScore[];
}

export function scoreNameAgainstPegawai(nameRaw: string, pegawai: Pegawai[]): NameScore[] {
  const { normalized, tokens } = normalizeName(nameRaw);
  const scores: NameScore[] = pegawai.map((p) => {
    const pNorm = normalizeName(p.nama);
    const sim = stringSimilarity(normalized, pNorm.normalized);
    const overlap = tokenOverlap(tokens, pNorm.tokens);
    // Weighted blend: full-string similarity catches typos/transpositions,
    // token overlap catches reordering and dropped middle names/initials.
    const score = sim * 0.6 + overlap * 0.4;
    return { pegawai: p, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

export function matchNameToPegawai(nameRaw: string, pegawai: Pegawai[]): MatchResult {
  const ranked = scoreNameAgainstPegawai(nameRaw, pegawai);
  const top = ranked[0];

  if (!top || top.score < MATCH_THRESHOLD) {
    return { status: 'unmatched', pegawai: null, candidates: ranked.slice(0, 5) };
  }

  const second = ranked[1];
  if (second && top.score - second.score < AMBIGUOUS_GAP && second.score >= MATCH_THRESHOLD) {
    return { status: 'ambiguous', pegawai: null, candidates: ranked.slice(0, 5) };
  }

  return { status: 'matched', pegawai: top.pegawai, candidates: ranked.slice(0, 5) };
}
