import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Allow json up to 25mb for audio base64
app.use(express.json({ limit: '25mb' }));

// Initialize GoogleGenAI
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const MODEL_NAME = 'gemini-2.5-flash';
// 思考モードを切る（既定オンだと数秒かかる。この用途では不要）
const FAST = { thinkingConfig: { thinkingBudget: 0 } };

// 1. 今日の質問を選ぶ
app.post('/api/gemini/select-question', async (req, res) => {
  try {
    const { questions, answeredIds = [], recipient, allowDeep = false, recentThemes = [] } = req.body;

    // Filter available questions in code first to enforce strict safety constraints
    const answeredSet = new Set(answeredIds);
    let candidates = questions.filter((q: { id: string; depth: string }) => !answeredSet.has(q.id));
    if (!allowDeep) {
      candidates = candidates.filter((q: { depth: string }) => q.depth !== 'deep');
    }

    // Avoid 3-consecutive theme rule if last two are identical
    if (recentThemes.length >= 2 && recentThemes[0] === recentThemes[1]) {
      const avoidTheme = recentThemes[0];
      const nonConsecutive = candidates.filter((q: { theme: string }) => q.theme !== avoidTheme);
      if (nonConsecutive.length > 0) {
        candidates = nonConsecutive;
      }
    }

    if (!candidates || candidates.length === 0) {
      candidates = questions; // Fallback if everything answered
    }

    const ai = getAI();
    if (!ai) {
      // Fallback: pick randomly from candidates
      const randomQ = candidates[Math.floor(Math.random() * candidates.length)];
      return res.json({
        questionId: randomQ.id,
        textForRecipient: randomQ.text,
        why: '本日のおすすめの問いです。',
      });
    }

    // プロンプトを小さくする: 候補をテーマ分散で最大12問に絞る（Geminiは選ぶだけ。全件送る必要はない）
    type Cand = { id: string; theme: string; depth: string; text: string };
    const shuffled = [...(candidates as Cand[])].sort(() => Math.random() - 0.5);
    const byTheme = new Map<string, Cand[]>();
    for (const q of shuffled) {
      if (!byTheme.has(q.theme)) byTheme.set(q.theme, []);
      byTheme.get(q.theme)!.push(q);
    }
    const sampled: Cand[] = [];
    let round = 0;
    while (sampled.length < Math.min(12, shuffled.length)) {
      let added = false;
      for (const list of byTheme.values()) {
        if (list[round]) { sampled.push(list[round]); added = true; }
        if (sampled.length >= 12) break;
      }
      if (!added) break;
      round += 1;
    }
    candidates = sampled;
    const candidateSummary = sampled.map((q) => ({ id: q.id, theme: q.theme, text: q.text }));

    const prompt = `
あなたは大切な人へ自分の言葉をのこす記録帳アプリ「NOCOSU」の案内人です。
宛先である「${recipient?.name || '大切な人'}」（間柄: ${recipient?.relation || '未定'}、年齢帯: ${recipient?.ageGroup || '未定'}）が、ユーザー本人へ向けて尋ねる今日の質問を、以下の候補リストから【必ず1つ】選んでください。

【候補質問リスト】:
${JSON.stringify(candidateSummary)}

【厳格なルール】:
1. 候補リストに実在する質問の "id" のみを "questionId" として返してください。リスト外の新しい質問は絶対に作らないでください。
2. "textForRecipient" は、ユーザーが宛先に語りかける文ではなく、【宛先（${recipient?.name || '相手'}）がユーザーに尋ねる言葉】（疑問形・問いかけ）に自然に言い換えた1文（60文字以内）にしてください。元の質問の意味や論点は絶対に変えないでください。
   【口調の指定】:
   ・宛先の間柄が「子ども (child)」の場合:
     子どもの口調（例: 元の質問『小さいころ、何になりたかったですか?』→『お父さんは小さいころ、何になりたかったの?』）。
     ※呼び名は recipient.name（${recipient?.name || ''}）を使い、関係が child で呼び名が『君』などの場合は『お父さん/お母さん』を推定せず『あなた』を使ってください（例: 『あなたは小さいころ、何になりたかったの？』『ねえ、小さいころは何になりたかったの？』）。
   ・宛先の間柄が「親 (parent)」の場合:
     親から子への温かく落ち着いた口調、あるいは敬意ある丁寧な問いかけ口調。
   ・宛先の間柄が「未来の自分 (future_me)」の場合:
     『君は〜?』という未来からの問いかけ口調（例: 『あの頃の君は、何に夢中だった?』『君は今、どんな気持ちでいる?』）。
   ・宛先の間柄が「パートナー (partner)」の場合:
     対等で親しい口調（例: 『ねえ、小さいころは何になりたかったの？』）。
   ・宛先の間柄が「友人 (friend)」の場合:
     気さくで親しい友人の口調（例: 『そういえば、昔は何になりたかったの？』）。
   ・宛先の間柄が「その他 (other)」の場合:
     親しみのある丁寧な問いかけ口調。
3. "why" は、なぜ今日この質問を選んだかの短い理由（30字以内）にしてください。

JSON形式で返してください。
`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        ...FAST,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questionId: { type: Type.STRING },
            textForRecipient: { type: Type.STRING },
            why: { type: Type.STRING },
          },
          required: ['questionId', 'textForRecipient'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const validCandidate = candidates.find((c: { id: string }) => c.id === parsed.questionId);

    if (validCandidate) {
      return res.json({
        questionId: validCandidate.id,
        // 宛先が1人のときだけ「その人の声」。宛先なし（複数）のときは元の文のまま
        textForRecipient: recipient ? parsed.textForRecipient || validCandidate.text : validCandidate.text,
        why: parsed.why || '今日あなたに届いた問いです。',
      });
    } else {
      // Candidate not in list, fallback to random candidate
      const fallbackQ = candidates[Math.floor(Math.random() * candidates.length)];
      return res.json({
        questionId: fallbackQ.id,
        textForRecipient: fallbackQ.text,
        why: '本日のおすすめの問いです。',
      });
    }
  } catch (error) {
    console.error('Error in select-question:', error);
    // Safe fallback
    const { questions = [], answeredIds = [], allowDeep = false } = req.body;
    const answeredSet = new Set(answeredIds as string[]);
    let pool = (questions as { id: string; depth: string; text: string }[]).filter(
      (q) => !answeredSet.has(q.id) && (allowDeep || q.depth !== 'deep')
    );
    if (pool.length === 0) pool = questions;
    const fallbackQ = pool[Math.floor(Math.random() * pool.length)] || {
      id: 'fallback',
      text: '今日あった小さく嬉しかったことを教えてください。',
    };
    return res.json({
      questionId: fallbackQ.id,
      textForRecipient: fallbackQ.text,
      why: '本日のおすすめの問いです。',
    });
  }
});

// 2. 追い質問
app.post('/api/gemini/follow-up', async (req, res) => {
  try {
    const { question, answerText, recipient } = req.body;
    const ai = getAI();

    if (!ai) {
      return res.json({ followUp: 'もう少し、詳しく聞かせてください。' });
    }

    const prompt = `
あなたは「NOCOSU」の静かな聞き手です。
ユーザーが「${recipient?.name || '大切な人'}」に向けて以下の質問に答えました。

質問: "${question}"
ユーザーの回答:
"${answerText}"

【禁止事項】:
- 評価（素晴らしいですね、など）、称賛、共感の押し付け、助言、要約、言い換えは一切禁止です。
- 本文を直したり提案したりしてはいけません。

【ルール】:
- 次の4つの型のいずれか1つを選び、ユーザーがさらに心を開いて語りたくなるような追い質問を【1文・40字以内】で作成してください。
  1. 「なぜ〜」
  2. 「たとえばどんなとき〜」
  3. 「そのとき誰が〜」
  4. 「今はどう思う〜」
`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        ...FAST,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            followUp: { type: Type.STRING },
          },
          required: ['followUp'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const followUp = parsed.followUp ? parsed.followUp.trim() : 'もう少し、詳しく聞かせてください。';
    return res.json({ followUp });
  } catch (error) {
    console.error('Error in follow-up:', error);
    return res.json({ followUp: 'もう少し、詳しく聞かせてください。' });
  }
});

// 3. 音声文字起こし
app.post('/api/gemini/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: '音声データがありません。' });
    }

    const ai = getAI();
    if (!ai) {
      return res.status(503).json({ error: 'APIキーが設定されていないため音声認識を利用できません。' });
    }

    const audioPart = {
      inlineData: {
        data: audioBase64,
        mimeType: mimeType.split(';')[0] || 'audio/webm',
      },
    };

    const textPart = {
      text: `
この日本語音声を文字起こししてください。
【重要ルール】:
- 話し言葉のまま文字にしてください。
- 言い淀み（えーと、あの、など）、方言、言葉の繰り返し、言い直しは絶対に消さず、そのまま書き起こしてください。
- 整形や要約は一切禁止です。
- 句読点（、。）だけを自然に補ってください。
JSON形式で {"transcript": "..."} を返してください。
`,
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [audioPart, textPart] },
      config: {
        ...FAST,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
          },
          required: ['transcript'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ transcript: parsed.transcript || '' });
  } catch (error) {
    console.error('Error in transcribe:', error);
    return res.status(500).json({ error: '音声の文字起こしに失敗しました。もう一度録音するか、直接入力してください。' });
  }
});

// 4. 鏡（あなたの言葉から）
app.post('/api/gemini/mirror', async (req, res) => {
  try {
    const { answers = [] } = req.body; // Array of { id, text, questionText }
    if (!answers || answers.length === 0) {
      return res.json({ items: [] });
    }

    const ai = getAI();
    if (!ai) {
      return res.json({ items: [] });
    }

    const prompt = `
あなたは「NOCOSU」の鏡です。
ユーザーがこれまで残した回答のテキスト（最大30件）を渡します。
回答者自身の本文から、特に本人の息づかいや温もりが宿っている箇所を3〜5件引用し、静かに映し出してください。

【回答データ】:
${JSON.stringify(answers, null, 2)}

【厳格な遵守ルール】:
1. "quote" は、必ず指定した "answerId" の本文の中に【一字一句完全に同一で実在する部分文字列】を抜き出してください。
   文字数は15文字以上、60文字以内。
   要約・言い換え・語尾変更・修飾の追加は【絶対禁止】です。
2. "label" は、その言葉が宿している気配を表す言葉（10文字以内）。
   性格の評価、診断、「あなたは〜な人」「〜な性格」などの分析・決めつけは【厳禁】です。
   良い例: 「大事にしている時間」「あの頃の風景」「ふと思うこと」「家族のぬくもり」
3. 3〜5件の items を返してください。

JSON形式で返してください。
`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        ...FAST,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  answerId: { type: Type.STRING },
                  quote: { type: Type.STRING },
                  label: { type: Type.STRING },
                },
                required: ['answerId', 'quote', 'label'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const rawItems = parsed.items || [];

    // Filter server-side too: verify exact match in source answer
    const answerMap = new Map(answers.map((a: { id: string; text: string }) => [a.id, a.text]));
    const verifiedItems = rawItems.filter((item: { answerId: string; quote: string; label: string }) => {
      const original = answerMap.get(item.answerId);
      if (!original || typeof original !== 'string') return false;
      return original.includes(item.quote) && item.quote.length >= 10;
    });

    return res.json({ items: verifiedItems });
  } catch (error) {
    console.error('Error in mirror:', error);
    return res.json({ items: [] });
  }
});

// 5. 手紙の編纂
app.post('/api/gemini/compile-letter', async (req, res) => {
  try {
    const { answers = [], recipient } = req.body;
    if (!answers || answers.length === 0) {
      return res.status(400).json({ error: '回答が選択されていません。' });
    }

    const ai = getAI();
    if (!ai) {
      // Local fallback
      const sections = answers.map((a: { id: string; questionText: string }) => ({
        heading: a.questionText || 'のこした言葉',
        answerId: a.id,
      }));
      return res.json({
        title: `${recipient?.name || '大切なあなた'}へ、のこす手紙`,
        sections,
      });
    }

    const prompt = `
あなたは「NOCOSU」の手紙編纂役です。
ユーザーが「${recipient?.name || '大切な人'}」（間柄: ${recipient?.relation || '未定'}）に向けて残した回答から、一通の美しい手紙の目次構成（順序と見出し）を編んでください。

【選ばれた回答リスト】:
${JSON.stringify(answers, null, 2)}

【厳格な遵守ルール】:
1. 回答の本文（text）は絶対に返さないでください。AIが本文を書き直したり付け足したりすることは固く禁じられています。
2. 構成の順序: 軽い日常の話題や昔の思い出から始め、深みのある話や思いを中盤に配置し、最後は宛先への温かな言葉で締めくくるように、回答の順序（sections内の並び順）を決めてください。
3. "heading" は、その回答の内容にふさわしい章見出し（20文字以内）。
4. すべての選択された回答の "answerId" を漏れなく1回ずつ含めてください。
5. "title" は、手紙全体の題名（例: 「${recipient?.name || 'あなた'}へ、これまでの日々と伝えたいこと」など、30文字以内）。

JSON形式で返してください。
`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        ...FAST,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  heading: { type: Type.STRING },
                  answerId: { type: Type.STRING },
                },
                required: ['heading', 'answerId'],
              },
            },
          },
          required: ['title', 'sections'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');

    // 検証: 選ばれた回答IDを漏れなく1回ずつ。リスト外IDは捨て、欠けたIDは末尾に補う
    const selectedIds: string[] = answers.map((a: { id: string }) => a.id);
    type SelectedAnswer = { id: string; questionText: string };
    const byId = new Map<string, SelectedAnswer>(
      (answers as SelectedAnswer[]).map((a) => [a.id, a])
    );
    const seen = new Set<string>();
    const sections: { heading: string; answerId: string }[] = [];
    for (const s of (parsed.sections || []) as { heading?: string; answerId?: string }[]) {
      if (!s.answerId || !byId.has(s.answerId) || seen.has(s.answerId)) continue;
      seen.add(s.answerId);
      sections.push({
        heading: (s.heading || byId.get(s.answerId)!.questionText || 'のこした言葉').slice(0, 20),
        answerId: s.answerId,
      });
    }
    for (const id of selectedIds) {
      if (!seen.has(id)) {
        sections.push({ heading: byId.get(id)!.questionText || 'のこした言葉', answerId: id });
      }
    }

    return res.json({
      title: parsed.title || `${recipient?.name || 'あなた'}へ、のこす手紙`,
      sections,
    });
  } catch (error) {
    console.error('Error in compile-letter:', error);
    const { answers = [], recipient } = req.body;
    return res.json({
      title: `${recipient?.name || '大切なあなた'}へ、のこす手紙`,
      sections: answers.map((a: { id: string; questionText: string }) => ({
        heading: a.questionText || 'のこした言葉',
        answerId: a.id,
      })),
    });
  }
});

// Setup Vite or static serving
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`NOCOSU server running on port ${port}`);
  });
}

startServer();
