import {
  QuestionItem,
  RecipientProfile,
  AnswerItem,
  MirrorItem,
  LetterSection,
} from '../types';

export async function apiSelectQuestion(
  questions: QuestionItem[],
  answeredIds: string[],
  recipient: RecipientProfile | null,
  allowDeep: boolean,
  recentThemes: string[]
): Promise<{ questionId: string; textForRecipient: string; why: string }> {
  try {
    const res = await fetch('/api/gemini/select-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questions,
        answeredIds,
        recipient,
        allowDeep,
        recentThemes,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.questionId && data.textForRecipient) {
        return data;
      }
    }
  } catch (err) {
    console.warn('API select-question failed, using fallback', err);
  }

  // Fallback selection logic
  const answeredSet = new Set(answeredIds);
  let available = questions.filter((q) => !answeredSet.has(q.id));
  if (!allowDeep) {
    available = available.filter((q) => q.depth !== 'deep');
  }

  // Avoid same theme 3 days in a row
  if (recentThemes.length >= 2 && recentThemes[0] === recentThemes[1]) {
    const nonConsecutive = available.filter((q) => q.theme !== recentThemes[0]);
    if (nonConsecutive.length > 0) {
      available = nonConsecutive;
    }
  }

  if (available.length === 0) {
    available = questions;
  }

  const picked = available[Math.floor(Math.random() * available.length)];
  return {
    questionId: picked.id,
    textForRecipient: picked.text,
    why: '今日あなたに届いた問いかけです。',
  };
}

export async function apiFetchFollowUp(
  question: string,
  answerText: string,
  recipient: RecipientProfile | null
): Promise<string> {
  try {
    const res = await fetch('/api/gemini/follow-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answerText, recipient }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.followUp) {
        return data.followUp;
      }
    }
  } catch (err) {
    console.warn('API follow-up failed, using fallback', err);
  }

  // Fixed fallback requirement
  return 'もう少し、詳しく聞かせてください。';
}

export async function apiTranscribeAudio(audioBlob: Blob): Promise<string> {
  const base64Audio = await blobToBase64(audioBlob);

  const res = await fetch('/api/gemini/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: base64Audio,
      mimeType: audioBlob.type || 'audio/webm',
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || '音声の文字起こしに失敗しました。');
  }

  const data = await res.json();
  return data.transcript || '';
}

export async function apiGenerateMirror(
  answers: AnswerItem[]
): Promise<MirrorItem[]> {
  const recentAnswers = answers.slice(0, 30).map((a) => ({
    id: a.id,
    text: a.text,
    questionText: a.questionText,
  }));

  try {
    const res = await fetch('/api/gemini/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: recentAnswers }),
    });

    if (res.ok) {
      const data = await res.json();
      const rawItems: MirrorItem[] = data.items || [];

      // Strict client-side validation: quote must be an exact substring of the original text
      const answerMap = new Map(answers.map((a) => [a.id, a.text]));
      const verifiedItems: MirrorItem[] = [];

      for (const item of rawItems) {
        const originalText = answerMap.get(item.answerId);
        if (
          originalText &&
          typeof item.quote === 'string' &&
          item.quote.length >= 10 &&
          originalText.includes(item.quote)
        ) {
          verifiedItems.push({
            answerId: item.answerId,
            quote: item.quote,
            label: item.label ? item.label.slice(0, 10) : '心に残る言葉',
          });
        }
      }

      return verifiedItems;
    }
  } catch (err) {
    console.warn('API mirror failed', err);
  }

  return [];
}

export async function apiCompileLetter(
  answers: AnswerItem[],
  recipient: RecipientProfile | null
): Promise<{ title: string; sections: LetterSection[] }> {
  const payload = answers.map((a) => ({
    id: a.id,
    questionText: a.questionText,
    answerText: a.text,
    theme: a.theme,
  }));

  try {
    const res = await fetch('/api/gemini/compile-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: payload, recipient }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.title && Array.isArray(data.sections) && data.sections.length > 0) {
        return {
          title: data.title,
          sections: data.sections,
        };
      }
    }
  } catch (err) {
    console.warn('API compile-letter failed, using fallback', err);
  }

  // Graceful fallback: sort in gentle sequence (childhood / daily first, then life, then to you)
  const themeOrder: Record<string, number> = {
    小さいころ: 1,
    家族のこと: 2,
    '好きなもの、毎日のこと': 3,
    仕事のこと: 4,
    気持ちのこと: 5,
    人との付き合い: 6,
    '迷ったとき、決めるとき': 7,
    失敗と後悔: 8,
    '生きること、死ぬこと': 9,
    あなたへ: 10,
  };

  const sortedAnswers = [...answers].sort((a, b) => {
    const orderA = themeOrder[a.theme] || 5;
    const orderB = themeOrder[b.theme] || 5;
    return orderA - orderB;
  });

  return {
    title: `${recipient?.name || '大切なあなた'}へ、のこす手紙`,
    sections: sortedAnswers.map((a) => ({
      heading: a.questionText,
      answerId: a.id,
    })),
  };
}

// Convert Blob to pure base64 (without data:... prefix)
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (result) {
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      } else {
        reject(new Error('Failed to convert audio blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
