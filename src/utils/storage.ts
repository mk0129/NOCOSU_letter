import {
  RecipientProfile,
  AnswerItem,
  TodayQuestionState,
  MirrorGeneration,
  CompiledLetter,
} from '../types';

const STORAGE_KEYS = {
  RECIPIENT: 'nocosu_recipient_profile',
  ANSWERS: 'nocosu_answers_list',
  TODAY_QUESTION: 'nocosu_today_question_state',
  MIRROR_CACHE: 'nocosu_mirror_generation',
  LETTERS: 'nocosu_compiled_letters',
  BOOKLET_ORDER_URL: 'nocosu_booklet_order_url',
};

// Recipient profile
export function getRecipientProfile(): RecipientProfile | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECIPIENT);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Error reading recipient profile', e);
    return null;
  }
}

export function saveRecipientProfile(profile: RecipientProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECIPIENT, JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving recipient profile', e);
  }
}

// Answers
export function getAnswers(): AnswerItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ANSWERS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading answers', e);
    return [];
  }
}

export function saveAnswer(answer: AnswerItem): void {
  try {
    const existing = getAnswers();
    const index = existing.findIndex((a) => a.id === answer.id);
    if (index >= 0) {
      existing[index] = answer;
    } else {
      existing.unshift(answer);
    }
    localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(existing));
  } catch (e) {
    console.error('Error saving answer', e);
  }
}

export function deleteAnswer(id: string): void {
  try {
    const existing = getAnswers();
    const filtered = existing.filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting answer', e);
  }
}

// Today question state
export function getTodayQuestionState(): TodayQuestionState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TODAY_QUESTION);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Error reading today question state', e);
    return null;
  }
}

export function saveTodayQuestionState(state: TodayQuestionState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TODAY_QUESTION, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving today question state', e);
  }
}

// Mirror Cache
export function getMirrorCache(): MirrorGeneration | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MIRROR_CACHE);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Error reading mirror cache', e);
    return null;
  }
}

export function saveMirrorCache(cache: MirrorGeneration): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MIRROR_CACHE, JSON.stringify(cache));
  } catch (e) {
    console.error('Error saving mirror cache', e);
  }
}

// Compiled letters
export function getCompiledLetters(): CompiledLetter[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LETTERS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading compiled letters', e);
    return [];
  }
}

export function saveCompiledLetter(letter: CompiledLetter): void {
  try {
    const existing = getCompiledLetters();
    const filtered = existing.filter((l) => l.id !== letter.id);
    filtered.unshift(letter);
    localStorage.setItem(STORAGE_KEYS.LETTERS, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error saving compiled letter', e);
  }
}

// Streak calculation (continuous days)
export function calculateStreak(answers: AnswerItem[]): number {
  if (!answers || answers.length === 0) return 0;

  // Extract unique sorted dates (descending)
  const dateSet = new Set(answers.map((a) => a.date));
  const uniqueDates = Array.from(dateSet).sort().reverse();

  if (uniqueDates.length === 0) return 0;

  const todayStr = getTodayDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = formatDateToString(yesterdayDate);

  // If user hasn't written today or yesterday, streak is 0
  const firstDate = uniqueDates[0];
  if (firstDate !== todayStr && firstDate !== yesterdayStr) {
    return 0;
  }

  let streak = 0;
  let expectedDate = new Date(firstDate);

  for (const dateStr of uniqueDates) {
    const currentDate = new Date(dateStr);
    const diffTime = Math.abs(expectedDate.getTime() - currentDate.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      streak++;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Helpers
export function getTodayDateString(): string {
  const d = new Date();
  return formatDateToString(d);
}

export function formatDateToString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatJapaneseDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[0], 10)}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
  }
  return dateStr;
}

export function formatPostmarkDate(dateStr: string): string {
  const target = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (isNaN(target.getTime())) return dateStr;
  const m = target.getMonth() + 1;
  const d = target.getDate();
  return `${m}.${d}`;
}

// Calculate 24 Solar Terms (二十四節気) from a date string (YYYY-MM-DD)
export function getSolarTerm(dateStr?: string): string {
  const target = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const month = (isNaN(target.getTime()) ? new Date() : target).getMonth() + 1;
  const day = (isNaN(target.getTime()) ? new Date() : target).getDate();
  const md = month * 100 + day;

  // Approximate standard transition dates (month * 100 + day) for the 24 solar terms
  const terms: { start: number; name: string }[] = [
    { start: 105, name: '小寒' },
    { start: 120, name: '大寒' },
    { start: 204, name: '立春' },
    { start: 219, name: '雨水' },
    { start: 305, name: '啓蟄' },
    { start: 320, name: '春分' },
    { start: 404, name: '清明' },
    { start: 420, name: '穀雨' },
    { start: 505, name: '立夏' },
    { start: 521, name: '小満' },
    { start: 605, name: '芒種' },
    { start: 621, name: '夏至' },
    { start: 707, name: '小暑' },
    { start: 723, name: '大暑' },
    { start: 807, name: '立秋' },
    { start: 823, name: '処暑' },
    { start: 907, name: '白露' },
    { start: 923, name: '秋分' },
    { start: 1008, name: '寒露' },
    { start: 1023, name: '霜降' },
    { start: 1107, name: '立冬' },
    { start: 1122, name: '小雪' },
    { start: 1207, name: '大雪' },
    { start: 1222, name: '冬至' },
  ];

  // Before Jan 5 is still 冬至 from December
  let current = '冬至';
  for (const term of terms) {
    if (md >= term.start) {
      current = term.name;
    } else {
      break;
    }
  }
  return current;
}

// Booklet order URL configuration
export function getBookletOrderUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.BOOKLET_ORDER_URL) || '';
  } catch (e) {
    console.error('Error reading booklet order url', e);
    return '';
  }
}

export function saveBookletOrderUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKLET_ORDER_URL, url.trim());
  } catch (e) {
    console.error('Error saving booklet order url', e);
  }
}

// Export / Import / Reset
export function exportAllData(): string {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    recipient: getRecipientProfile(),
    answers: getAnswers(),
    mirrorCache: getMirrorCache(),
    letters: getCompiledLetters(),
    bookletOrderUrl: getBookletOrderUrl(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAllData(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    if (data.recipient) saveRecipientProfile(data.recipient);
    if (Array.isArray(data.answers)) {
      localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(data.answers));
    }
    if (data.mirrorCache) saveMirrorCache(data.mirrorCache);
    if (Array.isArray(data.letters)) {
      localStorage.setItem(STORAGE_KEYS.LETTERS, JSON.stringify(data.letters));
    }
    if (typeof data.bookletOrderUrl === 'string') {
      saveBookletOrderUrl(data.bookletOrderUrl);
    }
    return true;
  } catch (e) {
    console.error('Import failed', e);
    return false;
  }
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.RECIPIENT);
  localStorage.removeItem(STORAGE_KEYS.ANSWERS);
  localStorage.removeItem(STORAGE_KEYS.TODAY_QUESTION);
  localStorage.removeItem(STORAGE_KEYS.MIRROR_CACHE);
  localStorage.removeItem(STORAGE_KEYS.LETTERS);
  localStorage.removeItem(STORAGE_KEYS.BOOKLET_ORDER_URL);
}

