import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RecipientProfile, QuestionItem, TodayQuestionState, AnswerItem, AppSettings, DialogueTurn } from './types';
import questionsData from './data/questions.json';
import {
  getRecipients,
  saveRecipients,
  getSettings,
  saveSettings,
  migrateIfNeeded,
  getAnswers,
  saveAnswer,
  getTodayQuestionState,
  saveTodayQuestionState,
  getTodayDateString,
  getProfile,
  saveProfile,
  getMirrorCache,
  saveMirrorCache,
} from './utils/storage';
import { apiSelectQuestion, apiGenerateMirror } from './utils/api';
import { maybeNotify } from './utils/reminder';
import {
  circleAvailable,
  ensureSession,
  joinCodeFromUrl,
  circleNameByCode,
  createCircle,
  joinCircle,
  myCircles,
  circleMembers,
  sharedAnswersOf,
  readsFor,
  markRead,
  shareAnswer,
  Circle,
  CircleMember,
  SharedAnswer,
  AnswerRead,
} from './utils/circle';
import { Timeline, FeedItem, FeedAnswer } from './components/Timeline';
import { Welcome } from './components/Welcome';
import { MeSheet } from './components/MeSheet';
import { OnboardingModal } from './components/OnboardingModal';

const questionsBank: QuestionItem[] = questionsData as QuestionItem[];

// v0.1（宛先1人）のデータがあれば移す
migrateIfNeeded();

export default function App() {
  // 自分
  const [profile, setProfile] = useState(() => getProfile());
  const [recipients, setRecipients] = useState<RecipientProfile[]>(() => getRecipients());
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [answers, setAnswers] = useState<AnswerItem[]>(() => getAnswers());
  const [todayState, setTodayState] = useState<TodayQuestionState | null>(() => getTodayQuestionState());
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [mirror, setMirror] = useState(() => getMirrorCache());

  // 家族の輪
  const [userId, setUserId] = useState<string | null>(null);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [shared, setShared] = useState<SharedAnswer[]>([]);
  const [reads, setReads] = useState<AnswerRead[]>([]);
  const [circleError, setCircleError] = useState('');

  // 招待リンク
  const [joinCode] = useState<string | null>(() => joinCodeFromUrl());
  const [inviteName, setInviteName] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  // 画面
  const [meOpen, setMeOpen] = useState(false);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [editRecipients, setEditRecipients] = useState(false);

  const todayDateStr = getTodayDateString();
  const myName = profile?.displayName || 'わたし';

  const currentQuestion = useMemo(
    () => (todayState?.questionId ? questionsBank.find((q) => q.id === todayState.questionId) || null : null),
    [todayState]
  );
  const todayAnswer = useMemo(() => answers.find((a) => a.date === todayDateStr) || null, [answers, todayDateStr]);
  const lastAnswerDate = useMemo(() => (answers.length ? [...answers].map((a) => a.date).sort().reverse()[0] : null), [answers]);
  const daysSinceLast = lastAnswerDate ? Math.floor((Date.now() - new Date(lastAnswerDate + 'T00:00:00').getTime()) / 86400000) : null;

  // 問いの声: 宛先が1人で、輪に入っていないときだけ
  const voiceRecipient = !circle && recipients.length === 1 ? recipients[0] : null;

  // ---- 輪の読み込み
  const refreshCircle = useCallback(async (c: Circle) => {
    const [m, s] = await Promise.all([circleMembers(c.id), sharedAnswersOf(c.id)]);
    setMembers(m);
    setShared(s);
    setReads(await readsFor(s.map((x) => x.id)));
  }, []);

  const loadCircle = useCallback(async () => {
    if (!circleAvailable) return;
    const cs = await myCircles();
    if (cs.length > 0) {
      setCircle(cs[0]);
      await refreshCircle(cs[0]);
    }
  }, [refreshCircle]);

  // 起動: ログイン済みなら輪を読む。招待コードがあれば輪の名前を取る
  useEffect(() => {
    (async () => {
      if (!circleAvailable) return;
      const s = await ensureSession();
      if ('userId' in s) {
        setUserId(s.userId);
        if (joinCode) setInviteName((await circleNameByCode(joinCode)) || '家族の輪');
        await loadCircle();
      } else if (joinCode) {
        setJoinError(s.error);
        setInviteName('家族の輪');
      }
    })();
  }, [joinCode, loadCircle]);

  // 輪の更新（開いている間は1分ごと）
  useEffect(() => {
    if (!circle) return;
    const id = window.setInterval(() => refreshCircle(circle), 60_000);
    const onVis = () => document.visibilityState === 'visible' && refreshCircle(circle);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [circle, refreshCircle]);

  // ---- 今日の問い
  const ensureTodayQuestion = useCallback(
    async (forceNew = false) => {
      const currentState = getTodayQuestionState();
      if (!forceNew && currentState && currentState.date === todayDateStr) {
        setTodayState(currentState);
        return;
      }
      setIsLoadingQuestion(true);
      try {
        const answeredIds = answers.map((a) => a.questionId);
        const recentThemes = answers.slice(0, 5).map((a) => a.theme);
        if (forceNew && currentState?.questionId) {
          answeredIds.push(currentState.questionId);
          const cur = questionsBank.find((q) => q.id === currentState.questionId);
          if (cur) recentThemes.unshift(cur.theme);
        }
        const selected = await apiSelectQuestion(questionsBank, answeredIds, voiceRecipient, settings.allowDeep, recentThemes);
        const newState: TodayQuestionState = {
          date: todayDateStr,
          questionId: selected.questionId,
          textForRecipient: selected.textForRecipient,
          recipientId: voiceRecipient?.id,
          why: selected.why,
          hasChangedToday: forceNew,
        };
        saveTodayQuestionState(newState);
        setTodayState(newState);
      } catch (e) {
        console.error('Failed to select today question', e);
      } finally {
        setIsLoadingQuestion(false);
      }
    },
    [answers, todayDateStr, voiceRecipient, settings.allowDeep]
  );

  useEffect(() => {
    if (profile) ensureTodayQuestion();
  }, [profile, ensureTodayQuestion]);

  // 朝の通知
  useEffect(() => {
    const tick = () => maybeNotify(!!todayAnswer, voiceRecipient?.name || null);
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [todayAnswer, voiceRecipient, settings.reminderEnabled, settings.reminderTime]);

  // 鏡: 自分の答えが10通ごとに一枚
  useEffect(() => {
    if (answers.length === 0 || answers.length % 10 !== 0) return;
    if (mirror && mirror.items.length && mirror.count === answers.length) return;
    (async () => {
      const items = await apiGenerateMirror(answers);
      if (items.length) {
        const cache = { generatedAt: new Date().toISOString(), items, count: answers.length };
        saveMirrorCache(cache);
        setMirror(cache);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.length]);

  // ---- 動作
  const handleWelcomeDone = async (name: string) => {
    const p = { displayName: name, createdAt: new Date().toISOString() };
    saveProfile(p);
    setProfile(p);
    if (joinCode && circleAvailable) {
      setJoining(true);
      setJoinError('');
      const s = await ensureSession();
      if ('error' in s) {
        setJoinError(s.error);
        setJoining(false);
        return;
      }
      setUserId(s.userId);
      const r = await joinCircle(joinCode, name);
      if (typeof r === 'string') setJoinError(r);
      else {
        setCircle(r);
        await refreshCircle(r);
        window.history.replaceState(null, '', '/');
      }
      setJoining(false);
    }
  };

  const handleCreateCircle = async () => {
    setCircleError('');
    const s = await ensureSession();
    if ('error' in s) {
      setCircleError(s.error);
      return;
    }
    setUserId(s.userId);
    const r = await createCircle(`${myName}の家族`, myName);
    if (typeof r === 'string') setCircleError(r);
    else {
      setCircle(r);
      await refreshCircle(r);
    }
  };

  const handleSeal = async (text: string, toFamily: boolean): Promise<AnswerItem> => {
    const q = currentQuestion!;
    const a: AnswerItem = {
      id: `ans-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      questionId: q.id,
      questionText: q.text,
      textForRecipient: todayState?.textForRecipient || q.text,
      theme: q.theme,
      depth: q.depth,
      recipientIds: toFamily && circle ? ['circle:' + circle.id] : recipients.map((r) => r.id),
      recipientName: toFamily && circle ? circle.name : recipients.map((r) => r.name).join('・') || '自分',
      recipientRelation: recipients[0]?.relation || 'other',
      date: todayDateStr,
      createdAt: new Date().toISOString(),
      text,
    };
    saveAnswer(a);
    setAnswers(getAnswers());
    if (toFamily && circle) {
      const err = await shareAnswer(circle.id, myName, a);
      if (err) console.warn(err);
      await refreshCircle(circle);
    }
    return a;
  };

  const handleUpdateDialogue = async (answerId: string, dialogue: DialogueTurn[]) => {
    const a = getAnswers().find((x) => x.id === answerId);
    if (!a) return;
    const updated: AnswerItem = { ...a, dialogue, followUpQuestion: dialogue[0]?.q, followUpAnswer: dialogue[0]?.a };
    saveAnswer(updated);
    setAnswers(getAnswers());
    if (circle && a.recipientIds[0]?.startsWith('circle:')) {
      await shareAnswer(circle.id, myName, updated);
      await refreshCircle(circle);
    }
  };

  const handleReact = async (sharedId: string, reaction: 'read' | 'thanks') => {
    await markRead(sharedId, reaction);
    if (circle) setReads(await readsFor(shared.map((x) => x.id)));
  };

  // ---- 手紙の列を組む
  const feed: FeedItem[] = useMemo(() => {
    const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.display_name || '誰か';
    const items: FeedAnswer[] = [];
    const sharedMineIds = new Set(shared.filter((s) => s.user_id === userId).map((s) => s.local_answer_id));
    for (const s of shared) {
      const mine = s.user_id === userId;
      const rs = reads.filter((r) => r.shared_answer_id === s.id);
      items.push({
        kind: 'answer',
        key: 'shared-' + s.id,
        author: s.author_name,
        mine,
        date: s.answered_on,
        createdAt: s.created_at,
        question: s.question_text,
        body: s.text,
        dialogue: s.dialogue,
        readWhen: s.read_when,
        sharedId: s.id,
        reactions: mine ? rs.filter((r) => r.user_id !== userId).map((r) => ({ name: nameOf(r.user_id), reaction: r.reaction })) : undefined,
        myReaction: !mine ? rs.find((r) => r.user_id === userId)?.reaction : undefined,
      });
    }
    for (const a of answers) {
      if (sharedMineIds.has(a.id)) continue;
      items.push({
        kind: 'answer',
        key: 'local-' + a.id,
        author: myName,
        mine: true,
        date: a.date,
        createdAt: a.createdAt,
        question: a.textForRecipient || a.questionText,
        body: a.text,
        dialogue: a.dialogue,
        readWhen: a.readWhen,
        localOnly: !!circle,
      });
    }
    let list: FeedItem[] = items
      .filter((i) => !showMineOnly || i.mine)
      .sort((x, y) => (y.date + y.createdAt).localeCompare(x.date + x.createdAt));
    // 今日の自分の答えは上のカードに出ているので列からは外す
    list = list.filter((i) => !(i.kind === 'answer' && i.mine && i.date === todayDateStr));
    if (mirror && mirror.items.length && !showMineOnly) {
      const card: FeedItem = {
        kind: 'mirror',
        key: 'mirror-' + mirror.generatedAt,
        items: mirror.items.map((m) => {
          const a = answers.find((x) => x.id === m.answerId);
          return { label: m.label, quote: m.quote, from: a ? `わたし・${a.date.slice(5).replace('-', '/')}` : 'わたし' };
        }),
      };
      list.splice(Math.min(2, list.length), 0, card);
    }
    return list;
  }, [shared, answers, reads, members, userId, myName, circle, showMineOnly, mirror, todayDateStr]);

  const handleDataReset = () => {
    setProfile(null);
    setRecipients([]);
    setSettings(getSettings());
    setAnswers([]);
    setTodayState(null);
    setMirror(null);
    setMeOpen(false);
  };
  const handleDataImported = () => {
    migrateIfNeeded();
    setProfile(getProfile());
    setRecipients(getRecipients());
    setSettings(getSettings());
    setAnswers(getAnswers());
    setTodayState(getTodayQuestionState());
    setMirror(getMirrorCache());
  };

  return (
    <div className="min-h-screen paper-noise flex justify-center text-[#2B2B2B]">
      <div className="w-full max-w-md min-h-screen px-4 md:px-5">
        {profile && (
          <Timeline
            myName={myName}
            question={currentQuestion}
            todayState={todayState}
            todayAnswer={todayAnswer}
            isLoadingQuestion={isLoadingQuestion}
            hasCircle={!!circle}
            voiceName={voiceRecipient && todayState?.textForRecipient && todayState.textForRecipient !== currentQuestion?.text ? voiceRecipient.name : null}
            feed={feed}
            daysSinceLast={daysSinceLast}
            totalMine={answers.length}
            onSeal={handleSeal}
            onUpdateDialogue={handleUpdateDialogue}
            onReact={handleReact}
            onChangeQuestion={() => ensureTodayQuestion(true)}
            onOpenMe={() => setMeOpen(true)}
          />
        )}
        {showMineOnly && profile && (
          <button
            type="button"
            onClick={() => setShowMineOnly(false)}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[#2B2B2B] text-[#F4EFE6] text-xs shadow-none cursor-pointer z-30"
          >
            あなたの手紙だけ表示中 ・ 全部見る
          </button>
        )}

        {!profile && <Welcome inviteCircleName={joinCode ? inviteName : null} onDone={handleWelcomeDone} busy={joining} error={joinError} />}

        <MeSheet
          open={meOpen}
          onClose={() => setMeOpen(false)}
          myName={myName}
          answers={answers}
          recipients={recipients}
          settings={settings}
          circle={circle}
          members={members}
          circleError={circleError}
          onCreateCircle={handleCreateCircle}
          onShowMine={() => setShowMineOnly(true)}
          onUpdateSettings={(patch) => {
            const next = { ...settings, ...patch };
            saveSettings(next);
            setSettings(next);
          }}
          onEditRecipients={() => {
            setMeOpen(false);
            setEditRecipients(true);
          }}
          onDataReset={handleDataReset}
          onDataImported={handleDataImported}
        />

        {editRecipients && (
          <OnboardingModal
            key="edit"
            isOpen
            mode="edit"
            initialRecipients={recipients}
            onSave={(list) => {
              saveRecipients(list);
              setRecipients(list);
              setEditRecipients(false);
              ensureTodayQuestion(true);
            }}
            onClose={() => setEditRecipients(false)}
          />
        )}
      </div>
    </div>
  );
}
