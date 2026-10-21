import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { AnswerItem, CircleRelation, CIRCLE_RELATIONS } from '../types';
import { circleAvailable, inviteUrl, Circle, CircleMember, SharedAnswer, AnswerRead, CircleQuestion } from '../utils/circle';
import { formatJapaneseDate } from '../utils/storage';
import { Users, Copy, Check, Send } from 'lucide-react';

interface Props {
  answers: AnswerItem[];
  userId: string | null;
  circle: Circle | null;
  members: CircleMember[];
  shared: SharedAnswer[];
  reads: AnswerRead[];
  mineSharedIds: Set<string>;
  circleQuestion: CircleQuestion | null;
  joinCode: string | null;
  joinPreview: { name: string; relation: CircleRelation; member_count: number } | null;
  error: string;
  busy: boolean;
  onCreate: (name: string, displayName: string, relation: CircleRelation) => Promise<void>;
  onJoin: (code: string, displayName: string) => Promise<void>;
  onShare: (a: AnswerItem) => Promise<void>;
  onReact: (sharedId: string, reaction: 'read' | 'thanks') => Promise<void>;
}

/** 輪: 招待リンクで入る。同じ問いに答えて、互いの言葉を読む。反応は「読んだ」「ありがとう」だけ */
export const CircleView: React.FC<Props> = ({
  answers,
  userId,
  circle,
  members,
  shared,
  reads,
  mineSharedIds,
  circleQuestion,
  joinCode,
  joinPreview,
  error,
  busy,
  onCreate,
  onJoin,
  onShare,
  onReact,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [relation, setRelation] = useState<CircleRelation>('family');
  const [code, setCode] = useState(joinCode || '');
  const [mode, setMode] = useState<'join' | 'create'>(joinCode ? 'join' : 'create');
  const [tab, setTab] = useState<'read' | 'send'>('read');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!circle) {
      setQr('');
      return;
    }
    QRCode.toDataURL(inviteUrl(circle.invite_code), { margin: 1, width: 200, color: { dark: '#2B2B2B', light: '#FAF7F0' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [circle]);

  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.display_name || '誰か';
  const readsByAnswer = useMemo(() => {
    const map = new Map<string, AnswerRead[]>();
    for (const r of reads) {
      if (!map.has(r.shared_answer_id)) map.set(r.shared_answer_id, []);
      map.get(r.shared_answer_id)!.push(r);
    }
    return map;
  }, [reads]);
  const relationLabel = (r: CircleRelation) => CIRCLE_RELATIONS.find((x) => x.id === r)?.label || '';

  if (!circleAvailable) {
    return (
      <div className="space-y-4 pb-24">
        <Header />
        <p className="text-sm text-[#6E685E] font-mincho">輪は準備中です。</p>
      </div>
    );
  }

  // ---- 輪に入っていない
  if (!circle) {
    return (
      <div className="space-y-5 pb-24">
        <Header />

        <div className="flex items-center gap-1.5">
          {(['join', 'create'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer ${mode === m ? 'border-[#2B2B2B] text-[#2B2B2B] font-medium' : 'border-[#E0D8CB] text-[#6E685E]'}`}
            >
              {m === 'join' ? '招待されている' : '自分が作る'}
            </button>
          ))}
        </div>

        <div className="washi-card rounded-2xl p-5 space-y-3">
          {mode === 'join' && joinPreview && (
            <p className="text-sm font-mincho text-[#2B2B2B] leading-relaxed">
              「{joinPreview.name}」（{relationLabel(joinPreview.relation)}・{joinPreview.member_count}人）に招待されています。
            </p>
          )}
          <span className="text-xs font-medium text-[#6E685E]">あなたの呼び名（輪の人に見える）</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例: お父さん、まさひろ"
            maxLength={20}
            className="w-full px-3.5 py-2.5 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-sm focus:outline-hidden focus:border-[#2B2B2B]"
          />

          {mode === 'join' ? (
            <>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="招待コード（6文字）"
                maxLength={6}
                className="w-full px-3.5 py-2.5 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-lg tracking-[0.3em] text-center focus:outline-hidden focus:border-[#2B2B2B]"
              />
              <button
                type="button"
                disabled={busy || code.length < 6 || !displayName.trim()}
                onClick={() => onJoin(code, displayName.trim())}
                className="w-full py-3 border border-[#2B2B2B] rounded-xl text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-[#2B2B2B]/5"
              >
                {busy ? '入っています…' : '輪に入る'}
              </button>
            </>
          ) : (
            <>
              <span className="text-xs font-medium text-[#6E685E]">どんな間柄ですか</span>
              <div className="flex flex-wrap gap-1.5">
                {CIRCLE_RELATIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRelation(r.id)}
                    className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer ${relation === r.id ? 'border-[#2B2B2B] bg-[#EFE9DC] text-[#2B2B2B]' : 'border-[#E0D8CB] text-[#6E685E]'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#6E685E] leading-relaxed">
                作ると招待リンクが出ます。相手はリンクを開いて呼び名を入れるだけ。メールもパスワードもありません。
              </p>
              <button
                type="button"
                disabled={busy || !displayName.trim()}
                onClick={() => onCreate(`${displayName.trim()}の${relationLabel(relation)}の輪`, displayName.trim(), relation)}
                className="w-full py-3 border border-[#2B2B2B] rounded-xl text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-[#2B2B2B]/5"
              >
                {busy ? '作っています…' : '輪を作る'}
              </button>
            </>
          )}
          {error && <p className="text-xs text-[#A94420] leading-relaxed">{error}</p>}
        </div>
      </div>
    );
  }

  // ---- 輪の中
  const link = inviteUrl(circle.invite_code);
  const others = shared.filter((s) => s.user_id !== userId);
  const ownShared = shared.filter((s) => s.user_id === userId);
  const answeredIds = circleQuestion
    ? new Set(shared.filter((s) => s.question_id === circleQuestion.question_id && s.created_at >= circleQuestion.created_at).map((s) => s.user_id))
    : new Set<string>();

  return (
    <div className="space-y-5 pb-24">
      <Header />

      {/* 輪の情報と招待 */}
      <div className="washi-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#2B2B2B] flex items-center gap-1.5">
            <Users className="w-4 h-4" /> {circle.name}
          </span>
          <span className="text-[11px] text-[#8E877D]">{relationLabel(circle.relation)}</span>
        </div>
        <p className="text-xs text-[#6E685E]">
          {members.map((m) => (
            <span key={m.user_id} className="mr-2">
              {m.display_name}
              {circleQuestion && (answeredIds.has(m.user_id) ? ' ✓' : ' …')}
            </span>
          ))}
        </p>
        {circleQuestion && (
          <p className="text-xs text-[#6E685E] font-mincho leading-relaxed">
            いまの問い: {circleQuestion.question_text}（{answeredIds.size}/{members.length}人）
          </p>
        )}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-[#8E877D]">招待</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* noop */
              }
            }}
            className="px-3 py-1 rounded-full border border-[#2B2B2B] text-[#2B2B2B] cursor-pointer inline-flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} リンクをコピー
          </button>
          {typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={() => navigator.share({ title: 'NOCOSU', text: `${circle.name}に招待します`, url: link }).catch(() => {})}
              className="px-3 py-1 rounded-full border border-[#E0D8CB] text-[#2B2B2B] cursor-pointer"
            >
              LINEなどで送る
            </button>
          )}
        </div>
        {qr && (
          <details>
            <summary className="text-[11px] text-[#8E877D] cursor-pointer">QRを見せる</summary>
            <img src={qr} alt="招待QR" className="mt-2 w-40 h-40 rounded-lg border border-[#E0D8CB]" />
          </details>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {(['read', 'send'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer ${tab === t ? 'border-[#2B2B2B] text-[#2B2B2B] font-medium' : 'border-[#E0D8CB] text-[#6E685E]'}`}
          >
            {t === 'read' ? `みんなの言葉（${others.length}）` : `自分の手紙（${ownShared.length}通を輪に）`}
          </button>
        ))}
      </div>

      {tab === 'read' ? (
        others.length === 0 ? (
          <div className="washi-card rounded-2xl p-5 text-center space-y-2">
            <p className="text-sm font-mincho text-[#2B2B2B]">まだ誰の言葉も届いていません。</p>
            <p className="text-xs text-[#6E685E]">招待リンクを送ると、その人の答えがここに現れます。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {others.map((s) => {
              const rs = readsByAnswer.get(s.id) || [];
              const mineR = rs.find((r) => r.user_id === userId);
              return (
                <article key={s.id} className="washi-card rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-[#8E877D]">
                    <span className="font-hand text-sm text-[#2B2B2B]">{s.author_name} より</span>
                    <span>{formatJapaneseDate(s.answered_on)}</span>
                  </div>
                  <h3 className="font-hand text-lg text-[#2B2B2B] leading-relaxed">{s.question_text}</h3>
                  <p className="text-sm font-mincho text-[#2B2B2B] leading-[1.9] whitespace-pre-wrap">{s.text}</p>
                  {s.dialogue && s.dialogue.length > 0 && (
                    <div className="pl-3 border-l border-[#E0D8CB] space-y-1.5">
                      {s.dialogue.map((d, i) => (
                        <div key={i}>
                          <p className="text-xs font-hand text-[#524E48]">{d.q}</p>
                          <p className="text-sm font-mincho text-[#2B2B2B] whitespace-pre-wrap">{d.a}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!!mineR}
                      onClick={() => onReact(s.id, 'read')}
                      className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer disabled:cursor-default ${mineR ? 'border-[#E0D8CB] text-[#8E877D]' : 'border-[#2B2B2B] text-[#2B2B2B] hover:bg-[#2B2B2B]/5'}`}
                    >
                      {mineR ? '読みました' : '読んだ'}
                    </button>
                    <button
                      type="button"
                      disabled={mineR?.reaction === 'thanks'}
                      onClick={() => onReact(s.id, 'thanks')}
                      className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer disabled:cursor-default ${mineR?.reaction === 'thanks' ? 'border-[#B5443A] text-[#B5443A]' : 'border-[#E0D8CB] text-[#6E685E] hover:border-[#B5443A] hover:text-[#B5443A]'}`}
                    >
                      ありがとう
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#6E685E] leading-relaxed">輪に届けた言葉は、輪の人だけが読めます。本文は一文字も変えません。</p>
          {answers.length === 0 ? (
            <p className="text-sm font-mincho text-[#8E877D]">まだ一通も。今日の問いから。</p>
          ) : (
            answers.map((a) => {
              const sent = mineSharedIds.has(a.id);
              const own = ownShared.find((s) => s.local_answer_id === a.id);
              const rs = own ? readsByAnswer.get(own.id) || [] : [];
              return (
                <div key={a.id} className="washi-card rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#8E877D]">
                    <span>{formatJapaneseDate(a.date)}</span>
                    {rs.length > 0 && (
                      <span className="text-[#B5443A]">
                        {rs.map((r) => `${nameOf(r.user_id)}が${r.reaction === 'thanks' ? 'ありがとう' : '読みました'}`).join('・')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-hand text-[#2B2B2B]">{a.textForRecipient || a.questionText}</p>
                  <p className="text-xs font-mincho text-[#6E685E] line-clamp-2">{a.text}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onShare(a)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border cursor-pointer ${sent ? 'border-[#E0D8CB] text-[#8E877D]' : 'border-[#2B2B2B] text-[#2B2B2B] hover:bg-[#2B2B2B]/5'}`}
                  >
                    <Send className="w-3 h-3" /> {sent ? '届けました（送り直す）' : '輪に届ける'}
                  </button>
                </div>
              );
            })
          )}
          {error && <p className="text-xs text-[#A94420]">{error}</p>}
        </div>
      )}
    </div>
  );
};

const Header: React.FC = () => (
  <div className="space-y-1 pt-1 border-b border-[#E0D8CB] pb-3">
    <h2 className="text-xl font-mincho font-medium text-[#2B2B2B]">輪</h2>
    <p className="text-xs text-[#6E685E]">同じ問いに答えて、互いの言葉を読む。全員が答えたら、次の問いが届きます。</p>
  </div>
);
