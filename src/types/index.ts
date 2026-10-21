export type RecipientRelation =
  | 'child'
  | 'partner'
  | 'parent'
  | 'friend'
  | 'future_me'
  | 'other';

export interface RecipientProfile {
  id: string; // 宛先ID（C案: 宛先は1〜3人）
  relation: RecipientRelation;
  name: string; // 呼び方 (例: 「ひなた」「お父さん」「10年後の僕」)
  ageGroup?: string; // 年齢帯 (例: 「小学生」「中高生」「20代」「同年代」「未設定」)
  allowDeep?: boolean; // 互換用（v0.1）。設定は AppSettings.allowDeep に移行
  updatedAt: string;
}

export const MAX_RECIPIENTS = 3;

export interface AppSettings {
  allowDeep: boolean; // 「深い質問も含める」初期オフ
  reminderEnabled: boolean; // 朝の通知
  reminderTime: string; // 'HH:MM'
  lastNotifiedDate?: string; // YYYY-MM-DD（同じ日に二度鳴らさない）
}
export const DEFAULT_SETTINGS: AppSettings = { allowDeep: false, reminderEnabled: false, reminderTime: '07:30' };

export type DepthLevel = 'light' | 'deep';

export interface QuestionItem {
  id: string;
  theme: string;
  depth: DepthLevel;
  text: string;
}

export interface TodayQuestionState {
  date: string; // YYYY-MM-DD
  questionId: string;
  textForRecipient: string; // 宛先が1人のときだけ「その人の声」。それ以外は元の文
  recipientId?: string; // 声の主（宛先1人のとき）
  why?: string;
  hasChangedToday: boolean; // 1日1回限定
}

export interface AnswerItem {
  id: string;
  questionId: string;
  questionText: string;
  textForRecipient: string;
  theme: string;
  depth: DepthLevel;
  recipientIds: string[]; // 届け先（複数可。封をするときに選ぶ）
  recipientName: string; // 表示用（呼び名を「・」で連結）
  recipientRelation: RecipientRelation; // 互換用（先頭の宛先）
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO
  text: string; // 本文（ユーザー自身の言葉）
  followUpQuestion?: string; // 追い質問（1往復目。互換用）
  followUpAnswer?: string; // 追い質問への回答（1往復目。互換用）
  dialogue?: DialogueTurn[]; // 聞き手モード: 追い質問の往復（最大5）
  readWhen?: ReadWhen; // いつ読んでほしいか
}

export interface DialogueTurn {
  q: string; // 宛先の声での問い
  a: string; // 本人の言葉
}

export type ReadWhen = '小さいうちに' | '10代で' | '大人になったら' | 'つらいときに' | '親になったら' | 'いつでも';
export const READ_WHEN_OPTIONS: ReadWhen[] = ['小さいうちに', '10代で', '大人になったら', 'つらいときに', '親になったら', 'いつでも'];

export interface Trustee {
  name: string; // 託す人の呼び名
  note?: string; // 連絡先や一言
  updatedAt: string;
}

export interface MirrorItem {
  quote: string; // 本文からの一字一句同じ抜粋
  label: string; // 10字以内のラベル
  answerId: string;
}

export interface MirrorGeneration {
  generatedAt: string;
  items: MirrorItem[];
}

export interface LetterSection {
  heading: string;
  answerId: string;
}

export interface CompiledLetter {
  id: string;
  createdAt: string;
  title: string;
  recipientName: string;
  sections: LetterSection[];
  answerIds: string[];
}
