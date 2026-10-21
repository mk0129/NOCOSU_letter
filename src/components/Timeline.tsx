import React, { useEffect, useRef, useState } from 'react';
import { AnswerItem, DialogueTurn, QuestionItem, TodayQuestionState } from '../types';
import { AudioRecorder } from '../utils/audioRecorder';
import { apiTranscribeAudio, apiFetchFollowUp } from '../utils/api';
import { formatPostmarkDate, getSolarTerm, formatJapaneseDate } from '../utils/storage';
import { Mic, Square, Loader2 } from 'lucide-react';

// 画面はこれ一枚。上に今日の問い、下に家族の手紙（本文そのまま）。反応は「読んだ」「ありがとう」だけ。

export interface FeedAnswer {
  kind: 'answer';
  key: string;
  author: string;
  mine: boolean;
  date: string; // YYYY-MM-DD
  createdAt: string;
  question: string;
  body: string;
  dialogue?: DialogueTurn[] | null;
  readWhen?: string | null;
  sharedId?: string; // 輪に送られた答え（反応できる）
  localOnly?: boolean; // 自分だけにのこした
  reactions?: { name: string; reaction: 'read' | 'thanks' }[]; // 自分の答えへの反応
  myReaction?: 'read' | 'thanks';
}
export interface FeedMirror {
  kind: 'mirror';
  key: string;
  items: { label: string; quote: string; from: string }[];
}
export type FeedItem = FeedAnswer | FeedMirror;

interface Props {
  myName: string;
  question: QuestionItem | null;
  todayState: TodayQuestionState | null;
  todayAnswer: AnswerItem | null;
  isLoadingQuestion: boolean;
  hasCircle: boolean;
  voiceName: string | null; // 宛先1人・輪なしのときだけ「○○からの問い」
  feed: FeedItem[];
  daysSinceLast: number | null;
  totalMine: number;
  onSeal: (text: string, toFamily: boolean) => Promise<AnswerItem>;
  onUpdateDialogue: (answerId: string, dialogue: DialogueTurn[]) => Promise<void>;
  onReact: (sharedId: string, reaction: 'read' | 'thanks') => Promise<void>;
  onChangeQuestion: () => void;
  onOpenMe: () => void;
}

const MAX_TURNS = 5;

export const Timeline: React.FC<Props> = ({
  myName,
  question,
  todayState,
  todayAnswer,
  isLoadingQuestion,
  hasCircle,
  voiceName,
  feed,
  daysSinceLast,
  totalMine,
  onSeal,
  onUpdateDialogue,
  onReact,
  onChangeQuestion,
  onOpenMe,
}) => {
  const today = todayState?.date || '';
  const shownQuestion = todayState?.textForRecipient || question?.text || '';

  return (
    <div className="pb-16">
      {/* ヘッダー: 名前の丸だけ。タブは無い */}
      <header className="sticky top-0 z-30 flex items-center justify-between py-3 bg-[#F4EFE6]/92 backdrop-blur-sm border-b border-[#E0D8CB]">
        <h1 className="text-lg font-mincho font-medium tracking-[0.12em] text-[#2B2B2B]">NOCOSU</h1>
        <button
          type="button"
          onClick={onOpenMe}
          className="w-9 h-9 rounded-full border border-[#2B2B2B] bg-[#FAF7F0] text-xs text-[#2B2B2B] flex items-center justify-center cursor-pointer"
          aria-label="自分のページ"
        >
          {myName.slice(0, 2)}
        </button>
      </header>

      {daysSinceLast !== null && daysSinceLast >= 3 && !todayAnswer && (
        <p className="text-xs text-[#6E685E] font-mincho text-center mt-3">
          {daysSinceLast}日ぶりですね。空いた日のことは、気にしなくて大丈夫です。
        </p>
      )}

      {/* 今日の問い */}
      <TodayCard
        key={todayState?.questionId || 'today'}
        today={today}
        questionText={shownQuestion}
        originalText={question?.text || ''}
        theme={question?.theme || ''}
        voiceName={voiceName}
        isLoading={isLoadingQuestion}
        todayAnswer={todayAnswer}
        hasCircle={hasCircle}
        canChange={!todayState?.hasChangedToday}
        onSeal={onSeal}
        onUpdateDialogue={onUpdateDialogue}
        onChangeQuestion={onChangeQuestion}
      />

      {/* 手紙の列 */}
      <div className="space-y-3 mt-3">
        {feed.length === 0 && (
          <div className="washi-card rounded-2xl p-5 text-center space-y-2">
            <p className="text-sm font-mincho text-[#2B2B2B]">{totalMine > 0 ? '今日の分は上に。明日から、ここに並びます。' : 'まだ一通も。今日の問いから。'}</p>
            <p className="text-xs text-[#6E685E]">
              {hasCircle ? '家族が答えると、ここに現れます。' : '右上の丸から家族を招待すると、家族の答えもここに並びます。'}
            </p>
          </div>
        )}
        {feed.map((item) =>
          item.kind === 'mirror' ? (
            <section key={item.key} className="washi-card rounded-2xl p-5 border-l-[3px] border-l-[#B5443A] space-y-2">
              <span className="text-[11px] tracking-widest text-[#8E877D]">あなたの言葉から</span>
              {item.items.map((m, i) => (
                <p key={i} className="text-sm font-mincho text-[#2B2B2B] leading-relaxed">
                  「{m.quote}」
                  <span className="block text-[11px] text-[#8E877D] mt-0.5">
                    {m.label} ・ {m.from}
                  </span>
                </p>
              ))}
              <p className="text-[11px] text-[#8E877D]">要約ではなく、書いたままの言葉です。</p>
            </section>
          ) : (
            <AnswerCard key={item.key} item={item} onReact={onReact} />
          )
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 今日の問い（書く欄つき）
const TodayCard: React.FC<{
  today: string;
  questionText: string;
  originalText: string;
  theme: string;
  voiceName: string | null;
  isLoading: boolean;
  todayAnswer: AnswerItem | null;
  hasCircle: boolean;
  canChange: boolean;
  onSeal: (text: string, toFamily: boolean) => Promise<AnswerItem>;
  onUpdateDialogue: (answerId: string, dialogue: DialogueTurn[]) => Promise<void>;
  onChangeQuestion: () => void;
}> = ({ today, questionText, originalText, theme, voiceName, isLoading, todayAnswer, hasCircle, canChange, onSeal, onUpdateDialogue, onChangeQuestion }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [toFamily, setToFamily] = useState(true);
  const [sealing, setSealing] = useState(false);
  const [err, setErr] = useState('');

  // 声
  const recRef = useRef<AudioRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  useEffect(() => {
    recRef.current = new AudioRecorder();
    return () => recRef.current?.cancel();
  }, []);
  useEffect(() => {
    if (!recording) return;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  // 追い質問（封をしたあと、最大5往復）
  const [saved, setSaved] = useState<AnswerItem | null>(todayAnswer);
  const [dialogue, setDialogue] = useState<DialogueTurn[]>(todayAnswer?.dialogue || []);
  useEffect(() => {
    if (todayAnswer && !saved) {
      setSaved(todayAnswer);
      setDialogue(todayAnswer.dialogue || []);
    }
  }, [todayAnswer, saved]);
  const [fq, setFq] = useState('');
  const [fa, setFa] = useState('');
  const [fetching, setFetching] = useState(false);
  const [followDone, setFollowDone] = useState(false);

  const toggleRecord = async (target: 'main' | 'follow') => {
    if (!recRef.current) return;
    setErr('');
    if (recording) {
      setRecording(false);
      setTranscribing(true);
      try {
        const blob = await recRef.current.stop();
        const t = await apiTranscribeAudio(blob);
        if (t.trim()) {
          if (target === 'main') setText((p) => (p ? `${p}\n${t.trim()}` : t.trim()));
          else setFa((p) => (p ? `${p}\n${t.trim()}` : t.trim()));
        }
      } catch (e) {
        setErr((e as Error).message || '音声の文字起こしに失敗しました');
      } finally {
        setTranscribing(false);
      }
    } else {
      try {
        await recRef.current.start();
        setRecording(true);
      } catch (e) {
        setErr((e as Error).message || 'マイクを使えませんでした');
      }
    }
  };

  const fetchNext = async (base: AnswerItem, turns: DialogueTurn[]) => {
    setFetching(true);
    setFq('');
    setFa('');
    try {
      const transcript = turns.map((d) => `問い: ${d.q}\n答え: ${d.a}`).join('\n\n');
      const ctx = transcript ? `${base.text}\n\n【これまでの往復】\n${transcript}` : base.text;
      const q = await apiFetchFollowUp(base.questionText, ctx, null);
      setFq(q);
    } catch {
      setFq('もう少し、詳しく聞かせてください。');
    } finally {
      setFetching(false);
    }
  };

  const seal = async () => {
    if (!text.trim()) {
      setErr('ひとことでも大丈夫です。');
      return;
    }
    setSealing(true);
    setErr('');
    try {
      const a = await onSeal(text.trim(), hasCircle && toFamily);
      setSaved(a);
      setOpen(false);
      await fetchNext(a, []);
    } catch (e) {
      setErr((e as Error).message || '封をできませんでした');
    } finally {
      setSealing(false);
    }
  };

  const answerTurn = async (more: boolean) => {
    if (!saved) return;
    const a = fa.trim();
    const next = a && fq ? [...dialogue, { q: fq, a }] : dialogue;
    setDialogue(next);
    if (next.length !== dialogue.length) await onUpdateDialogue(saved.id, next);
    if (more && next.length < MAX_TURNS) {
      await fetchNext(saved, next);
    } else {
      setFollowDone(true);
    }
  };

  const sealed = !!saved;

  return (
    <section className="washi-card rounded-2xl p-5 mt-3 border-[#C9BFAE] space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracking-[0.12em] text-[#B5443A]">{voiceName ? `${voiceName}からの問い` : '今日の問い'}</span>
        <div className="w-11 h-11 rounded-full border border-[#2B2B2B] flex flex-col items-center justify-center text-[9px] leading-tight text-[#2B2B2B]">
          <span>{formatPostmarkDate(today)}</span>
          <span className="w-5 border-t border-[#2B2B2B] my-0.5" />
          <span className="font-mincho text-[10px]">{getSolarTerm(today)}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-16 rounded-xl bg-[#EFE9DC]/60 animate-pulse" />
      ) : (
        <>
          <p className={`font-hand leading-relaxed ${sealed ? 'text-base text-[#6E685E]' : 'text-[22px] text-[#2B2B2B]'}`}>{questionText}</p>
          {!sealed && voiceName && originalText && originalText !== questionText && (
            <p className="text-[11px] text-[#8E877D]">元の問い: {originalText}</p>
          )}
        </>
      )}

      {/* 書く欄 */}
      {!sealed && !isLoading && (open ? (
        <div className="space-y-3">
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            placeholder="思いつくままに。上手に書こうとせず、普段の言葉で。短くて大丈夫です"
            className="w-full p-4 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl font-mincho text-[15px] leading-[1.9] text-[#2B2B2B] placeholder-[#A49E93] focus:outline-hidden focus:border-[#2B2B2B] resize-y"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleRecord('main')}
              disabled={transcribing}
              className={`px-3 py-1.5 rounded-full text-xs border border-[#E0D8CB] text-[#2B2B2B] cursor-pointer inline-flex items-center gap-1 ${recording ? 'animate-pulse border-[#B5443A] text-[#B5443A]' : ''}`}
            >
              {recording ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
              {recording ? `停止（${seconds}秒）` : '声で答える'}
            </button>
            {transcribing && (
              <span className="text-xs text-[#8E877D] inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> 話し言葉のまま文字にしています
              </span>
            )}
            {hasCircle && (
              <button
                type="button"
                onClick={() => setToFamily((v) => !v)}
                className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer ${toFamily ? 'border-[#2B2B2B] text-[#2B2B2B]' : 'border-[#E0D8CB] text-[#8E877D]'}`}
              >
                {toFamily ? '家族に届ける' : '自分だけ'}
              </button>
            )}
          </div>
          {err && <p className="text-xs text-[#A94420]">{err}</p>}
          <button
            type="button"
            onClick={seal}
            disabled={sealing || recording || transcribing}
            className="w-full py-3 border border-[#2B2B2B] rounded-xl text-sm font-medium text-[#2B2B2B] hover:bg-[#2B2B2B]/5 disabled:opacity-40 cursor-pointer"
          >
            {sealing ? '封をしています…' : '封をする'}
          </button>
          <p className="text-[11px] text-[#8E877D] text-center">答えなくても大丈夫です。</p>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full py-3 border border-[#2B2B2B] rounded-xl text-sm font-medium text-[#2B2B2B] hover:bg-[#2B2B2B]/5 cursor-pointer"
          >
            答える
          </button>
          {canChange && (
            <button type="button" onClick={onChangeQuestion} className="w-full text-[11px] text-[#8E877D] cursor-pointer">
              別の問いにする（1日1回）
            </button>
          )}
        </div>
      ))}

      {/* 封をしたあと: 追い質問（任意） */}
      {sealed && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[#B5443A]">
            <span className="w-2 h-2 rounded-full bg-[#B5443A] inline-block" />
            <span>封をしました{saved && !saved.recipientIds.length ? '' : ''}</span>
          </div>
          {dialogue.length > 0 && (
            <div className="space-y-1.5">
              {dialogue.map((d, i) => (
                <div key={i}>
                  <p className="text-xs font-hand text-[#524E48]">{d.q}</p>
                  <p className="text-sm font-mincho text-[#2B2B2B] whitespace-pre-wrap pl-3 border-l border-[#E0D8CB]">{d.a}</p>
                </div>
              ))}
            </div>
          )}
          {!followDone && dialogue.length < MAX_TURNS && (
            <div className="space-y-2">
              {fetching ? (
                <p className="text-xs text-[#8E877D] inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> 聞き手が、あなたの言葉を読んでいます…
                </p>
              ) : fq ? (
                <>
                  <p className="font-hand text-lg text-[#2B2B2B] leading-relaxed">{fq}</p>
                  <textarea
                    rows={3}
                    value={fa}
                    onChange={(e) => setFa(e.target.value)}
                    placeholder="答えても、答えなくても大丈夫です"
                    className="w-full p-3 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl font-mincho text-sm leading-relaxed text-[#2B2B2B] placeholder-[#A49E93] focus:outline-hidden focus:border-[#2B2B2B] resize-y"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleRecord('follow')}
                      disabled={transcribing}
                      className={`px-3 py-1.5 rounded-full text-xs border border-[#E0D8CB] text-[#2B2B2B] cursor-pointer inline-flex items-center gap-1 ${recording ? 'animate-pulse border-[#B5443A] text-[#B5443A]' : ''}`}
                    >
                      {recording ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
                      {recording ? `停止（${seconds}秒）` : '声で'}
                    </button>
                    {dialogue.length + 1 < MAX_TURNS && (
                      <button
                        type="button"
                        disabled={!fa.trim() || recording || transcribing}
                        onClick={() => answerTurn(true)}
                        className="px-3 py-1.5 rounded-full text-xs border border-[#E0D8CB] text-[#2B2B2B] hover:border-[#2B2B2B] disabled:opacity-40 cursor-pointer"
                      >
                        答えて、もう一つ
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => answerTurn(false)}
                      disabled={recording || transcribing}
                      className="px-3 py-1.5 rounded-full text-xs border border-[#2B2B2B] text-[#2B2B2B] cursor-pointer"
                    >
                      {fa.trim() ? '答えて、今日はここまで' : '今日はここまで'}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => saved && fetchNext(saved, dialogue)}
                  className="px-3 py-1.5 rounded-full text-xs border border-[#E0D8CB] text-[#6E685E] hover:border-[#2B2B2B] cursor-pointer"
                >
                  聞き手に、もう一つ聞いてもらう
                </button>
              )}
            </div>
          )}
          {(followDone || dialogue.length >= MAX_TURNS) && (
            <p className="text-[11px] text-[#8E877D]">明日の朝、次の問いが届きます。</p>
          )}
        </div>
      )}
      {theme && !sealed && !open && <p className="text-[11px] text-[#8E877D] text-right">{theme}</p>}
    </section>
  );
};

// ---------------------------------------------------------------- 手紙（家族・自分）
const AnswerCard: React.FC<{ item: FeedAnswer; onReact: (sharedId: string, r: 'read' | 'thanks') => Promise<void> }> = ({ item, onReact }) => {
  const [busy, setBusy] = useState(false);
  return (
    <article className="washi-card rounded-2xl p-5 space-y-2">
      <div className="flex items-center justify-between text-[11px] text-[#8E877D]">
        <span className="font-hand text-[15px] text-[#2B2B2B]">{item.mine ? 'わたし' : item.author} より</span>
        <span>{formatJapaneseDate(item.date)}</span>
      </div>
      <p className="font-hand text-[15px] text-[#6E685E] leading-relaxed">{item.question}</p>
      <p className="text-[15px] font-mincho text-[#2B2B2B] leading-[1.9] whitespace-pre-wrap">{item.body}</p>
      {item.dialogue && item.dialogue.length > 0 && (
        <div className="pl-3 border-l border-[#E0D8CB] space-y-1.5">
          {item.dialogue.map((d, i) => (
            <div key={i}>
              <p className="text-xs font-hand text-[#524E48]">{d.q}</p>
              <p className="text-sm font-mincho text-[#2B2B2B] whitespace-pre-wrap">{d.a}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {!item.mine && item.sharedId && (
          <>
            <button
              type="button"
              disabled={busy || !!item.myReaction}
              onClick={async () => {
                setBusy(true);
                await onReact(item.sharedId!, 'read');
                setBusy(false);
              }}
              className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer disabled:cursor-default ${item.myReaction ? 'border-[#E0D8CB] text-[#8E877D]' : 'border-[#2B2B2B] text-[#2B2B2B]'}`}
            >
              {item.myReaction ? '読みました' : '読んだ'}
            </button>
            <button
              type="button"
              disabled={busy || item.myReaction === 'thanks'}
              onClick={async () => {
                setBusy(true);
                await onReact(item.sharedId!, 'thanks');
                setBusy(false);
              }}
              className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer disabled:cursor-default ${item.myReaction === 'thanks' ? 'border-[#B5443A] text-[#B5443A]' : 'border-[#E0D8CB] text-[#6E685E]'}`}
            >
              ありがとう
            </button>
          </>
        )}
        {item.mine && item.localOnly && <span className="text-[11px] text-[#8E877D]">自分だけ</span>}
        {item.mine && item.reactions && item.reactions.length > 0 && (
          <span className="text-[11px] text-[#B5443A] ml-auto">
            {item.reactions.map((r) => `${r.name}が${r.reaction === 'thanks' ? 'ありがとう' : '読みました'}`).join('・')}
          </span>
        )}
      </div>
    </article>
  );
};
