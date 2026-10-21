# >>> このファイルは CLAUDE.md から自動生成。直接編集しないこと <<<
# >>> 変更は CLAUDE.md → python3 _system/scripts/sync_claude_to_codex.py で反映 <<<

# NOCOSU app — 設計図（AI・人間共通）

このファイルは、このリポジトリで作業するすべてのエージェント（Claude / AI Studio / Antigravity）と人間が守る図面。
変更は人間が承認してから。上位の経緯は `../AGENTS.md` と `../redesign_recipients_and_onboarding_20261021.md`。

## 1. PRD（要約）
- **誰の、何を**: 幼い子をもち、病気と向き合う30〜40代の親が、「子どもに何を残せばいいか分からない」まま時間が過ぎる問題。元気なうちに、毎日3分、自分の言葉をのこす
- **一言**: 毎朝ひとつの問い。あなたの言葉で、大切な人へ。
- **核**: AIは本文を一文字も書かない・整えない。AIの役割は「聞く・映す・並べる」だけ
- **出口**: 手紙（画面・画像カード・冊子）。払うのは本人より家族と冊子
- **Non-goals（作らない）**: チャットUI / AIの整形・要約・提案 / フォロー・いいね・タイムライン / 宛先4人以上 / 課金（応募まで） / 故人や宛先の声の合成
- **v0.2 実装済み（最小）**: 家族の輪（招待コード、答えを輪に送る、読む、「読んだ」「ありがとう」）。メールのリンクでログイン
- **v0.2以降（別枠）**: 全員が答えたら開く / 世の中の輪（問い単位の匿名公開・しおり）/ 聞き手モードの音声（Gemini Live）

## 2. 技術スタック（固定。珍しいライブラリを足さない）
- Vite + React 19 + TypeScript + Tailwind v4（既存）
- Gemini API は **server.ts（Express）経由のみ**。クライアントからAPIキーを使わない
- モデル `gemini-2.5-flash`、全呼び出しで `thinkingConfig.thinkingBudget: 0`、JSON出力（responseSchema）
- アニメーションは `motion/react` のみ。アイコンは `lucide-react` 最小限（Sparkles禁止）
- フォント: 問い＝Zen Kurenaido（.font-hand）、本文＝Shippori Mincho 400（.font-mincho）、UI＝Zen Kaku Gothic New
- データ: 本人の答えは localStorage。**家族の輪は Supabase**（project `nocosu` rzjhfhjaxioqnxzkrltp, ap-northeast-1）。公開キーは `src/lib/supabase.ts`、RLSで守る。スキーマは `supabase/migrations/20261021_family_circle.sql`。`.env` に `GEMINI_API_KEY`（コミット禁止）

## 3. データスキーマ（先に固める。UIより優先）
```ts
Recipient(RecipientProfile) { id, name, relation: 'child'|'partner'|'parent'|'friend'|'future_me'|'other', ageBand?, createdAt }  // 1〜3人
Question     { id, theme, depth: 'light'|'deep', text }                     // 静的JSON。Geminiは新規作成しない
TodayQuestion{ date, questionId, textForRecipient?, recipientId?, hasChangedToday }  // 声つきは宛先1人のときだけ
Answer       { id, questionId, questionText, textForRecipient?, theme, depth,
               recipientIds: string[], date, createdAt, text,
               dialogue?: {q,a}[] (最大5), readWhen?, followUpQuestion?, followUpAnswer? (互換) }
Mirror       { generatedAt, items: {label, quote(原文完全一致), answerId}[] }
Letter       { id, createdAt, title, recipientId, sections: {heading, answerId}[], answerIds }
Trustee      { name, note?, updatedAt }
-- Supabase（家族の輪）
circles { id, name, invite_code, created_by }  circle_members { circle_id, user_id, display_name }
shared_answers { id, circle_id, user_id, author_name, local_answer_id, question_id, question_text, text(無加工), dialogue, read_when, answered_on }
answer_reads { shared_answer_id, user_id, reaction: 'read'|'thanks' }
RPC: create_circle(name, display_name) / join_circle(code, display_name)  -- security definer, authenticated のみ
```
- 宛先モデルは **C案**（問いは一つ、届け先は封をするときに複数選ぶ）。2026-10-21 承認・実装済み。v0.1 の単一宛先データは起動時に `migrateIfNeeded()` で移行
- 鏡の quote は `answer.text.includes(quote)` をサーバーとクライアントの両方で検証。落ちたものは表示しない
- 手紙の編纂は answerId と見出しだけ返す。本文は返さない・触らない

## 4. UIルール
- 色: 背景 #F4EFE6 / カード #FAF7F0 / 墨 #2B2B2B / 線 #E0D8CB / 朱 #B5443A（封緘と「今日」だけ）。グラデーション禁止、影禁止、線は1px
- 比喩は「封筒・便箋・束・封緘・消印」で統一。説明文より絵と動作で伝える
- 文言: 急がせない。「答えなくてもいい」「今日はここまで」を常に出す。「病気」「死」「終活」「エンディング」は出さない（深い質問の設定説明を除く）
- Empty State: 空の画面に無機質な文を出さない。束が空なら「つくった人から」の手紙（`src/data/sample_letter.json`）。将来は「つくった人の三通」（本物の答え）
- Loading: スピナーでなく輪郭（スケルトン）。追い質問は画面を先に進め、裏で取る
- 1画面1アクション。スマホ縦持ち基準、max-w-md

## 5. 作業ルール
- **1プロンプト・1機能・1コミット**。動いたら即コミット。壊れたら直さずロールバックしてやり直す
- 機能の実装と手触り（Polish）はフェーズを分ける
- `npx tsc --noEmit` が通らない状態でコミットしない
- 本文（answer.text）を変換・整形するコードを書かない。grep で `text.replace` / `trim()` 以外の加工が無いことを確認
- 新しい依存を足す前に人間に聞く

## 6. 確認コマンド
```bash
npm install --legacy-peer-deps
npm run dev        # http://localhost:3000
npx tsc --noEmit
```
