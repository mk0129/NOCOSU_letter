import React, { useEffect, useMemo, useState } from 'react';
import { AnswerItem } from '../types';
import {
  circleAvailable,
  getSessionUser,
  sendMagicLink,
  onAuthChange,
  signOut,
  myCircles,
  createCircle,
  joinCircle,
  circleMembers,
  sharedAnswersOf,
  readsFor,
  markRead,
  shareAnswer,
  mySharedLocalIds,
  Circle,
  CircleMember,
  SharedAnswer,
  AnswerRead,
} from '../utils/circle';
import { formatJapaneseDate } from '../utils/storage';
import { Loader2, Users, Copy, Check, LogOut, Send } from 'lucide-react';

interface Props {
  answers: AnswerItem[];
}

type Stage = 'loading' | 'signin' | 'sent' | 'nocircle' | 'circle';

/** 家族の輪: 同じ問いに家族が答え、互いの言葉を読む。読んだら「読んだ」「ありがとう」だけ返す */
export const CircleView: React.FC<Props> = ({ answers }) => {
  const [stage, setStage] = useState<Stage>('loading');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [shared, setShared] = useState<SharedAnswer[]>([]);
  const [reads, setReads] = useState<AnswerRead[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const [newName, setNewName] = useState('家族の輪');
  const [displayName, setDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<'read' | 'send'>('read');

  const refresh = async (c: Circle) => {
    const [m, s, ids] = await Promise.all([circleMembers(c.id), sharedAnswersOf(c.id), mySharedLocalIds(c.id)]);
    setMembers(m);
    setShared(s);
    setMine(ids);
    setReads(await readsFor(s.map((x) => x.id)));
  };

  const boot = async () => {
    if (!circleAvailable) {
      setStage('signin');
      return;
    }
    const u = await getSessionUser();
    if (!u) {
      setStage('signin');
      return;
    }
    setUserId(u.id);
    const cs = await myCircles();
    if (cs.length === 0) {
      setStage('nocircle');
      return;
    }
    setCircle(cs[0]);
    await refresh(cs[0]);
    setStage('circle');
  };

  useEffect(() => {
    boot();
    // メールのリンクから戻ってきたとき
    const off = onAuthChange(() => {
      boot();
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myName = useMemo(() => members.find((m) => m.user_id === userId)?.display_name || 'わたし', [members, userId]);
  const readsByAnswer = useMemo(() => {
    const map = new Map<string, AnswerRead[]>();
    for (const r of reads) {
      if (!map.has(r.shared_answer_id)) map.set(r.shared_answer_id, []);
      map.get(r.shared_answer_id)!.push(r);
    }
    return map;
  }, [reads]);
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.display_name || '誰か';

  // ---- 画面
  if (!circleAvailable) {
    return (
      <div className="space-y-4 pb-24">
        <Header />
        <p className="text-sm text-[#6E685E] font-mincho leading-relaxed">家族の輪は準備中です。</p>
      </div>
    );
  }

  if (stage === 'loading') {
    return (
      <div className="space-y-4 pb-24">
        <Header />
        <div className="flex items-center gap-2 text-xs text-[#8E877D]">
          <Loader2 className="w-4 h-4 animate-spin" /> 輪を確かめています…
        </div>
      </div>
    );
  }

  if (stage === 'signin' || stage === 'sent') {
    return (
      <div className="space-y-5 pb-24">
        <Header />
        <div className="washi-card rounded-2xl p-5 space-y-3">
          <p className="text-sm font-mincho text-[#2B2B2B] leading-relaxed">
            家族の言葉を読むには、メールで本人確認をします。パスワードはありません。
          </p>
          {stage === 'signin' ? (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス"
                className="w-full px-3.5 py-2.5 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-sm focus:outline-hidden focus:border-[#2B2B2B]"
              />
              <button
                type="button"
                disabled={busy || !email.includes('@')}
                onClick={async () => {
                  setBusy(true);
                  setMsg('');
                  const err = await sendMagicLink(email.trim());
                  setBusy(false);
                  if (err) setMsg(err);
                  else setStage('sent');
                }}
                className="w-full py-3 border border-[#2B2B2B] rounded-xl text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-[#2B2B2B]/5"
              >
                {busy ? '送っています…' : 'メールにリンクを送る'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-mincho text-[#2B2B2B] leading-relaxed">
                {email} にメールを送りました。
                <br />
                中のリンクを押すと、この画面に戻ってきます。
              </p>
              <p className="text-xs text-[#6E685E]">届かないときは迷惑メールも見てください。</p>
              <button type="button" onClick={() => setStage('signin')} className="text-xs text-[#8E877D] cursor-pointer">
                メールアドレスを直す
              </button>
            </>
          )}
          {msg && <p className="text-xs text-[#A94420]">{msg}</p>}
        </div>
      </div>
    );
  }

  if (stage === 'nocircle') {
    return (
      <div className="space-y-5 pb-24">
        <Header />
        <div className="washi-card rounded-2xl p-5 space-y-3">
          <span className="text-xs font-medium text-[#6E685E]">あなたの呼び名（家族に見える）</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例: お父さん、まさひろ"
            maxLength={20}
            className="w-full px-3.5 py-2.5 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-sm focus:outline-hidden focus:border-[#2B2B2B]"
          />
        </div>

        <div className="washi-card rounded-2xl p-5 space-y-3">
          <span className="text-sm font-medium text-[#2B2B2B]">輪を作る</span>
          <p className="text-xs text-[#6E685E]">招待コードが出ます。家族に伝えてください。</p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={30}
            className="w-full px-3.5 py-2.5 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-sm focus:outline-hidden focus:border-[#2B2B2B]"
          />
          <button
            type="button"
            disabled={busy || !displayName.trim()}
            onClick={async () => {
              setBusy(true);
              setMsg('');
              const r = await createCircle(newName, displayName);
              setBusy(false);
              if (typeof r === 'string') setMsg(r);
              else {
                setCircle(r);
                await refresh(r);
                setStage('circle');
              }
            }}
            className="w-full py-3 border border-[#2B2B2B] rounded-xl text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-[#2B2B2B]/5"
          >
            輪を作る
          </button>
        </div>

        <div className="washi-card rounded-2xl p-5 space-y-3">
          <span className="text-sm font-medium text-[#2B2B2B]">輪に入る</span>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="招待コード（6文字）"
            maxLength={6}
            className="w-full px-3.5 py-2.5 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-lg tracking-[0.3em] text-center focus:outline-hidden focus:border-[#2B2B2B]"
          />
          <button
            type="button"
            disabled={busy || joinCode.length < 6 || !displayName.trim()}
            onClick={async () => {
              setBusy(true);
              setMsg('');
              const r = await joinCircle(joinCode, displayName);
              setBusy(false);
              if (typeof r === 'string') setMsg(r);
              else {
                setCircle(r);
                await refresh(r);
                setStage('circle');
              }
            }}
            className="w-full py-3 border border-[#2B2B2B] rounded-xl text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-[#2B2B2B]/5"
          >
            入る
          </button>
        </div>
        {msg && <p className="text-xs text-[#A94420]">{msg}</p>}
        <button
          type="button"
          onClick={async () => {
            await signOut();
            setStage('signin');
          }}
          className="text-xs text-[#8E877D] cursor-pointer"
        >
          別のメールで入り直す
        </button>
      </div>
    );
  }

  // ---- 輪の中
  const others = shared.filter((s) => s.user_id !== userId);
  const ownShared = shared.filter((s) => s.user_id === userId);

  return (
    <div className="space-y-5 pb-24">
      <Header />

      {/* 輪の情報 */}
      <div className="washi-card rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#2B2B2B] flex items-center gap-1.5">
            <Users className="w-4 h-4" /> {circle?.name}
          </span>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              setCircle(null);
              setStage('signin');
            }}
            className="text-[#8E877D] hover:text-[#2B2B2B] cursor-pointer"
            title="この端末から出る"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[#6E685E]">{members.map((m) => m.display_name).join('・')}</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#8E877D]">招待コード</span>
          <span className="font-mono tracking-[0.25em] text-[#2B2B2B]">{circle?.invite_code}</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(circle?.invite_code || '');
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* noop */
              }
            }}
            className="text-[#8E877D] hover:text-[#2B2B2B] cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 読む / 送る */}
      <div className="flex items-center gap-1.5">
        {(['read', 'send'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer ${
              tab === t ? 'border-[#2B2B2B] text-[#2B2B2B] font-medium' : 'border-[#E0D8CB] text-[#6E685E]'
            }`}
          >
            {t === 'read' ? `家族の言葉（${others.length}）` : `輪に送る（${ownShared.length}通済み）`}
          </button>
        ))}
      </div>

      {tab === 'read' ? (
        others.length === 0 ? (
          <div className="washi-card rounded-2xl p-5 text-center space-y-2">
            <p className="text-sm font-mincho text-[#2B2B2B]">まだ誰の言葉も届いていません。</p>
            <p className="text-xs text-[#6E685E]">招待コードを家族に伝えると、その人の答えがここに現れます。</p>
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
                  {s.read_when && <p className="text-[11px] text-[#8E877D]">いつ読んでほしいか: {s.read_when}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!!mineR}
                      onClick={async () => {
                        await markRead(s.id, 'read');
                        setReads(await readsFor(shared.map((x) => x.id)));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer disabled:cursor-default ${
                        mineR ? 'border-[#E0D8CB] text-[#8E877D]' : 'border-[#2B2B2B] text-[#2B2B2B] hover:bg-[#2B2B2B]/5'
                      }`}
                    >
                      {mineR ? '読みました' : '読んだ'}
                    </button>
                    <button
                      type="button"
                      disabled={mineR?.reaction === 'thanks'}
                      onClick={async () => {
                        await markRead(s.id, 'thanks');
                        setReads(await readsFor(shared.map((x) => x.id)));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer disabled:cursor-default ${
                        mineR?.reaction === 'thanks'
                          ? 'border-[#B5443A] text-[#B5443A]'
                          : 'border-[#E0D8CB] text-[#6E685E] hover:border-[#B5443A] hover:text-[#B5443A]'
                      }`}
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
          <p className="text-xs text-[#6E685E] leading-relaxed">
            送った言葉は、輪の家族だけが読めます。本文はそのまま、一文字も変えません。
          </p>
          {answers.length === 0 ? (
            <p className="text-sm font-mincho text-[#8E877D]">まだ一通も。今日の封筒から。</p>
          ) : (
            answers.map((a) => {
              const sent = mine.has(a.id);
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
                    onClick={async () => {
                      if (!circle) return;
                      setBusy(true);
                      const err = await shareAnswer(circle.id, myName, a);
                      setBusy(false);
                      if (err) setMsg(err);
                      else await refresh(circle);
                    }}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border cursor-pointer ${
                      sent ? 'border-[#E0D8CB] text-[#8E877D]' : 'border-[#2B2B2B] text-[#2B2B2B] hover:bg-[#2B2B2B]/5'
                    }`}
                  >
                    <Send className="w-3 h-3" /> {sent ? '送り直す' : '輪に送る'}
                  </button>
                </div>
              );
            })
          )}
          {msg && <p className="text-xs text-[#A94420]">{msg}</p>}
        </div>
      )}
    </div>
  );
};

const Header: React.FC = () => (
  <div className="space-y-1 pt-1 border-b border-[#E0D8CB] pb-3">
    <h2 className="text-xl font-mincho font-medium text-[#2B2B2B]">輪</h2>
    <p className="text-xs text-[#6E685E]">家族の言葉を読み、自分の言葉を送る。読んだら「読んだ」だけ返す。</p>
  </div>
);
