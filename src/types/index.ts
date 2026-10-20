export type RecipientRelation =
  | 'child'
  | 'partner'
  | 'parent'
  | 'friend'
  | 'future_me'
  | 'other';

export interface RecipientProfile {
  relation: RecipientRelation;
  name: string; // 呼び方 (例: 「ひなた」「お父さん」「10年後の僕」)
  ageGroup?: string; // 年齢帯 (例: 「小学生」「中高生」「20代」「同年代」「未設定」)
  allowDeep: boolean; // 「深い質問も含める」初期オフ
  updatedAt: string;
}

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
  textForRecipient: string;
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
  recipientName: string;
  recipientRelation: RecipientRelation;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO
  text: string; // 本文（ユーザー自身の言葉）
  followUpQuestion?: string; // 追い質問
  followUpAnswer?: string; // 追い質問への回答
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
