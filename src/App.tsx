import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RecipientProfile,
  QuestionItem,
  TodayQuestionState,
  AnswerItem,
  AppSettings,
  CircleRelation,
} from './types';
import questionsData from './data/questions.json';
import firstQuestionsData from './data/first_questions.json';
import {
  getRecipients,
  saveRecipients,
  getSettings,
  saveSettings,
  migrateIfNeeded,
  getAnswers,
  saveAnswer,
  deleteAnswer as removeAnswer,
  getTodayQuestionState,
  saveTodayQuestionState,
  calculateStreak,
  getTodayDateString,
} from './utils/storage';
import { apiSelectQuestion } from './utils/api';
import { maybeNotify } from './utils/reminder';
import {
  circleAvailable,
  getSessionUser,
  ensureSession,
  joinCodeFromUrl,
  circlePreviewByCode,
  myCircles,
  createCircle,
  joinCircle,
  circleMembers,
  sharedAnswersOf,
  readsFor,
  markRead,
  shareAnswer,
  mySharedLocalIds,
  currentCircleQuestion,
  circleQuestionIds,
  advanceCircleQuestion,
  Circle,
  CircleMember,
  SharedAnswer,
  AnswerRead,
  CircleQuestion,
} from './utils/circle';
import { OnboardingModal } from './components/OnboardingModal';
import { BottomNav, NavTab } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { AnswerView } from './components/AnswerView';
import { HistoryView } from './components/HistoryView';
import { MirrorView } from './components/MirrorView';
import { LetterView } from './components/LetterView';
import { SettingsView } from './components/SettingsView';
import { FirstLetterPreview } from './components/FirstLetterPreview';
import { CircleView } from './components/CircleView';

const questionsBank: QuestionItem[] = questionsData as QuestionItem[];
const firstQuestions: QuestionItem[] = firstQuestionsData as QuestionItem[];

type FirstRunStage = 'intro' | 'answer' | 'preview' | null;

// v0.1（宛先1人）のデータがあれば、C案（宛先複数）へ移す
migrateIfNeeded();

export default function App() {
  // 宛先（1〜3人）と設定
  const [recipients, setRecipients] = useState<RecipientProfile[]>(() => getRecipients());
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());

  // 設定からの宛先編集モーダル
  const [isEditRecipientsOpen, setIsEditRecipientsOpen] = useState(false);

  // 初回体験: 4コマ → 宛先 → 軽い一問 → 手紙プレビュー
  const [firstRunStage, setFirstRunStage] = useState<FirstRunStage>(() =>
    getRecipients().length > 0 ? null : 'intro'
  );
  const [firstQuestion] = useState<QuestionItem>(
    () => firstQuestions[Math.floor(Math.random() * firstQuestions.length)]
  );
  const [firstAnswer, setFirstAnswer] = useState<AnswerItem | null>(null);

  // Navigation & Active View
  // メールのリンクから戻ってきたときは「輪」を開く（/?tab=circle）
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('tab') === 'circle' || sp.get('join') ? 'circle' : 'home';
    } catch {
      return 'home';
    }
  });
  const [isAnswering, setIsAnswering] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState<AnswerItem | null>(null);

  // Answers & Today state
  const [answers, setAnswers] = useState<AnswerItem[]>(() => getAnswers());
  const [todayState, setTodayState] = useState<TodayQuestionState | null>(() =>
    getTodayQuestionState()
  );
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);

  // 輪（同じ問いに答えて読み合う。全員が答えたら次の問い）
  const [userId, setUserId] = useState<string | null>(null);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [shared, setShared] = useState<SharedAnswer[]>([]);
  const [reads, setReads] = useState<AnswerRead[]>([]);
  const [mineSharedIds, setMineSharedIds] = useState<Set<string>>(new Set());
  const [circleQ, setCircleQ] = useState<CircleQuestion | null>(null);
  const [circleError, setCircleError] = useState('');
  const [circleBusy, setCircleBusy] = useState(false);
  const [joinCode] = useState<string | null>(() => joinCodeFromUrl());
  const [joinPreview, setJoinPreview] = useState<{ name: string; relation: CircleRelation; member_count: number } | null>(null);

  const todayDateStr = getTodayDateString();

  // 輪に入っているときは、輪の問いが「今日の問い」。別の問いにはできない
  const effectiveTodayState: TodayQuestionState | null = useMemo(() => {
    if (circle && circleQ) {
      return { date: todayDateStr, questionId: circleQ.question_id, textForRecipient: circleQ.question_text, why: `${circle.name}の問い`, hasChangedToday: true };
    }
    return todayState;
  }, [circle, circleQ, todayState, todayDateStr]);

  const currentQuestion = useMemo(() => {
    if (!effectiveTodayState?.questionId) return null;
    return questionsBank.find((q) => q.id === effectiveTodayState.questionId) || null;
  }, [effectiveTodayState]);

  const todayAnswer = useMemo(() => {
    if (circle && circleQ) {
      return answers.find((a) => a.questionId === circleQ.question_id && a.createdAt >= circleQ.created_at) || null;
    }
    return answers.find((a) => a.date === todayDateStr) || null;
  }, [answers, todayDateStr, circle, circleQ]);

  // 輪: 自分は答えたが、まだの人
  const waitingFor = useMemo(() => {
    if (!circle || !circleQ || !userId) return [];
    const answered = new Set(shared.filter((s) => s.question_id === circleQ.question_id && s.created_at >= circleQ.created_at).map((s) => s.user_id));
    if (!answered.has(userId)) return [];
    return members.filter((m) => !answered.has(m.user_id)).map((m) => m.display_name);
  }, [circle, circleQ, userId, shared, members]);

  const streakCount = useMemo(() => calculateStreak(answers), [answers]);
  const lastAnswerDate = useMemo(
    () => (answers.length ? [...answers].map((a) => a.date).sort().reverse()[0] : null),
    [answers]
  );

  // 朝の通知: 開いている間、1分ごとに条件を見る（閉じている間は .ics が保険）
  useEffect(() => {
    const voice = recipients.length === 1 ? recipients[0].name : null;
    const tick = () => {
      maybeNotify(!!todayAnswer, voice);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [todayAnswer, recipients, settings.reminderEnabled, settings.reminderTime]);

  // ---- 輪の読み込みと、問いの進行（全員が答えたら次）
  const syncCircleQuestion = useCallback(
    async (c: Circle, m: CircleMember[], s: SharedAnswer[]) => {
      const cur = await currentCircleQuestion(c.id);
      const everyoneAnswered =
        !!cur && m.length > 0 && m.every((mem) => s.some((x) => x.user_id === mem.user_id && x.question_id === cur.question_id && x.created_at >= cur.created_at));
      if (cur && !everyoneAnswered) {
        setCircleQ(cur);
        return;
      }
      // 次の問いを選んで置く（競合しても片方だけ通る）
      const used = await circleQuestionIds(c.id);
      const recentThemes = cur?.theme ? [cur.theme] : [];
      const picked = await apiSelectQuestion(questionsBank, used, null, settings.allowDeep, recentThemes, c.relation);
      const q = questionsBank.find((x) => x.id === picked.questionId);
      const next = await advanceCircleQuestion(c.id, { id: picked.questionId, text: q?.text || picked.textForRecipient, theme: q?.theme || '' });
      setCircleQ(next || cur);
    },
    [settings.allowDeep]
  );

  const refreshCircle = useCallback(
    async (c: Circle) => {
      const [m, s, ids] = await Promise.all([circleMembers(c.id), sharedAnswersOf(c.id), mySharedLocalIds(c.id)]);
      setMembers(m);
      setShared(s);
      setMineSharedIds(ids);
      setReads(await readsFor(s.map((x) => x.id)));
      await syncCircleQuestion(c, m, s);
    },
    [syncCircleQuestion]
  );

  useEffect(() => {
    (async () => {
      if (!circleAvailable) return;
      const u = await getSessionUser();
      if (u) {
        setUserId(u.id);
        const cs = await myCircles();
        if (cs.length) {
          setCircle(cs[0]);
          await refreshCircle(cs[0]);
        }
      }
      if (joinCode) {
        const s = await ensureSession();
        if ('userId' in s) {
          setUserId(s.userId);
          setJoinPreview(await circlePreviewByCode(joinCode));
        } else setCircleError(s.error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleCreateCircle = async (name: string, displayName: string, relation: CircleRelation) => {
    setCircleBusy(true);
    setCircleError('');
    const s = await ensureSession();
    if ('error' in s) {
      setCircleError(s.error);
      setCircleBusy(false);
      return;
    }
    setUserId(s.userId);
    const r = await createCircle(name, displayName, relation);
    if (typeof r === 'string') setCircleError(r);
    else {
      setCircle(r);
      await refreshCircle(r);
    }
    setCircleBusy(false);
  };

  const handleJoinCircle = async (code: string, displayName: string) => {
    setCircleBusy(true);
    setCircleError('');
    const s = await ensureSession();
    if ('error' in s) {
      setCircleError(s.error);
      setCircleBusy(false);
      return;
    }
    setUserId(s.userId);
    const r = await joinCircle(code, displayName);
    if (typeof r === 'string') setCircleError(r);
    else {
      setCircle(r);
      await refreshCircle(r);
      try {
        window.history.replaceState(null, '', '/');
      } catch {
        /* noop */
      }
    }
    setCircleBusy(false);
  };

  const myCircleName = useMemo(() => members.find((m) => m.user_id === userId)?.display_name || 'わたし', [members, userId]);

  const handleShareToCircle = async (a: AnswerItem) => {
    if (!circle) return;
    setCircleBusy(true);
    const err = await shareAnswer(circle.id, myCircleName, a);
    if (err) setCircleError(err);
    await refreshCircle(circle);
    setCircleBusy(false);
  };

  const handleReact = async (sharedId: string, reaction: 'read' | 'thanks') => {
    await markRead(sharedId, reaction);
    setReads(await readsFor(shared.map((x) => x.id)));
  };

  // 百通の地図から、今日の問いを自分で選ぶ（今日まだ封をしていないとき）
  const handlePickQuestion = (q: QuestionItem) => {
    if (todayAnswer || circle) return;
    const newState: TodayQuestionState = {
      date: todayDateStr,
      questionId: q.id,
      textForRecipient: q.text,
      why: '自分で選んだ問い',
      hasChangedToday: true,
    };
    saveTodayQuestionState(newState);
    setTodayState(newState);
    setCurrentTab('home');
    setEditingAnswer(null);
    setIsAnswering(true);
  };

  // 書き足すときは、その回答自身の問いを使う
  const editingQuestion: QuestionItem | null = useMemo(() => {
    if (!editingAnswer) return null;
    return {
      id: editingAnswer.questionId,
      theme: editingAnswer.theme,
      depth: editingAnswer.depth,
      text: editingAnswer.questionText,
    };
  }, [editingAnswer]);
  const editingTodayState: TodayQuestionState | null = useMemo(() => {
    if (!editingAnswer) return null;
    return {
      date: editingAnswer.date,
      questionId: editingAnswer.questionId,
      textForRecipient: editingAnswer.textForRecipient,
      hasChangedToday: false,
    };
  }, [editingAnswer]);

  // 今日の問いを用意する。宛先が1人のときだけ「その人の声」で言い換える
  const ensureTodayQuestion = useCallback(
    async (list: RecipientProfile[], allowDeep: boolean, forceNew = false) => {
      if (list.length === 0) return;
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
          // 「別の質問にする」では、いまの問いのテーマを必ず避ける
          const cur = questionsBank.find((q) => q.id === currentState.questionId);
          if (cur) recentThemes.unshift(cur.theme);
        }
        const voice = list.length === 1 ? list[0] : null;

        const selected = await apiSelectQuestion(questionsBank, answeredIds, voice, allowDeep, recentThemes);

        const newState: TodayQuestionState = {
          date: todayDateStr,
          questionId: selected.questionId,
          textForRecipient: selected.textForRecipient,
          recipientId: voice?.id,
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
    [answers, todayDateStr]
  );

  useEffect(() => {
    if (recipients.length > 0 && firstRunStage === null) {
      ensureTodayQuestion(recipients, settings.allowDeep);
    }
  }, [recipients, settings.allowDeep, firstRunStage, ensureTodayQuestion]);

  // 宛先を保存（初回 / 設定）
  const handleSaveRecipients = (list: RecipientProfile[]) => {
    saveRecipients(list);
    setRecipients(list);
    setIsEditRecipientsOpen(false);
    if (firstRunStage === 'intro') {
      setFirstRunStage('answer');
      return;
    }
    // 宛先が変わったら、今日の問いを取り直す（声の主が変わる）
    ensureTodayQuestion(list, settings.allowDeep, true);
  };

  // 初回体験: 一通目を封じた → 手紙の体裁で見せる
  const handleFirstAnswerSaved = (saved: AnswerItem) => {
    saveAnswer(saved);
    setAnswers(getAnswers());
    setFirstAnswer(saved);
    setFirstRunStage('preview');
  };

  const handleChangeQuestion = () => {
    if (circle || recipients.length === 0 || todayState?.hasChangedToday) return;
    ensureTodayQuestion(recipients, settings.allowDeep, true);
  };

  const handleSaveAnswer = async (saved: AnswerItem, opts?: { toCircle: boolean }) => {
    saveAnswer(saved);
    setAnswers(getAnswers());
    setIsAnswering(false);
    setEditingAnswer(null);
    if (circle && (opts?.toCircle || mineSharedIds.has(saved.id))) {
      await handleShareToCircle(saved);
    }
  };

  const handleDeleteAnswer = (id: string) => {
    removeAnswer(id);
    setAnswers(getAnswers());
  };

  const handleDataReset = () => {
    setRecipients([]);
    setSettings(getSettings());
    setAnswers([]);
    setTodayState(null);
    setIsAnswering(false);
    setCurrentTab('home');
    setFirstAnswer(null);
    setFirstRunStage('intro');
  };

  const handleDataImported = () => {
    migrateIfNeeded();
    const list = getRecipients();
    setRecipients(list);
    setSettings(getSettings());
    setAnswers(getAnswers());
    setTodayState(getTodayQuestionState());
    setCurrentTab('home');
    if (list.length > 0) setFirstRunStage(null);
  };

  const hasRecipients = recipients.length > 0;

  return (
    <div className="min-h-screen paper-noise flex justify-center py-0 md:py-6 text-[#2B2B2B]">
      <div className="w-full max-w-md min-h-screen md:min-h-[92vh] md:rounded-3xl paper-noise border-0 md:border md:border-[#E0D8CB] shadow-none flex flex-col relative overflow-hidden">
        <main className="flex-1 px-4 md:px-6 pt-5 pb-6 overflow-y-auto">
          {firstRunStage === 'answer' && hasRecipients ? (
            <AnswerView
              recipients={recipients}
              question={firstQuestion}
              todayState={null}
              existingAnswer={null}
              onSave={handleFirstAnswerSaved}
              onCancel={() => setFirstRunStage(null)}
              skipFollowUp
              firstRun
            />
          ) : isAnswering && (editingQuestion || currentQuestion) && hasRecipients ? (
            <AnswerView
              key={editingAnswer?.id || 'today'}
              recipients={recipients}
              question={(editingQuestion || currentQuestion)!}
              todayState={editingAnswer ? editingTodayState : effectiveTodayState}
              existingAnswer={editingAnswer}
              circleName={circle ? circle.name : null}
              onSave={handleSaveAnswer}
              onCancel={() => {
                setIsAnswering(false);
                setEditingAnswer(null);
              }}
            />
          ) : (
            <>
              {currentTab === 'home' && hasRecipients && (
                <HomeView
                  recipients={recipients}
                  todayState={effectiveTodayState}
                  currentQuestion={currentQuestion}
                  todayAnswer={todayAnswer}
                  streakCount={streakCount}
                  lastAnswerDate={lastAnswerDate}
                  waitingFor={waitingFor}
                  totalAnswerCount={answers.length}
                  isLoadingQuestion={isLoadingQuestion || (!!circle && !circleQ)}
                  onAnswerClick={() => {
                    setEditingAnswer(null);
                    setIsAnswering(true);
                  }}
                  onChangeQuestionClick={handleChangeQuestion}
                  onEditTodayAnswer={() => {
                    if (todayAnswer) {
                      setEditingAnswer(todayAnswer);
                      setIsAnswering(true);
                    }
                  }}
                />
              )}

              {currentTab === 'history' && (
                <HistoryView
                  answers={answers}
                  recipients={recipients}
                  onDeleteAnswer={handleDeleteAnswer}
                  onPickQuestion={handlePickQuestion}
                />
              )}

              {currentTab === 'mirror' && <MirrorView answers={answers} />}

              {currentTab === 'letter' && hasRecipients && (
                <LetterView answers={answers} recipients={recipients} />
              )}

              {currentTab === 'circle' && (
                <CircleView
                  answers={answers}
                  userId={userId}
                  circle={circle}
                  members={members}
                  shared={shared}
                  reads={reads}
                  mineSharedIds={mineSharedIds}
                  circleQuestion={circleQ}
                  joinCode={joinCode}
                  joinPreview={joinPreview}
                  error={circleError}
                  busy={circleBusy}
                  onCreate={handleCreateCircle}
                  onJoin={handleJoinCircle}
                  onShare={handleShareToCircle}
                  onReact={handleReact}
                />
              )}

              {currentTab === 'settings' && hasRecipients && (
                <SettingsView
                  recipients={recipients}
                  allowDeep={settings.allowDeep}
                  settings={settings}
                  onUpdateSettings={(patch) => {
                    const next = { ...settings, ...patch };
                    saveSettings(next);
                    setSettings(next);
                  }}
                  onEditRecipient={() => setIsEditRecipientsOpen(true)}
                  onUpdateDeepToggle={(allowDeep) => {
                    const next = { ...settings, allowDeep };
                    saveSettings(next);
                    setSettings(next);
                  }}
                  onDataReset={handleDataReset}
                  onDataImported={handleDataImported}
                />
              )}
            </>
          )}
        </main>

        {!isAnswering && firstRunStage === null && (
          <BottomNav
            currentTab={currentTab}
            onSelectTab={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* 初回: 4コマ → 誰に届けますか */}
        {firstRunStage === 'intro' && (
          <OnboardingModal key="first" isOpen mode="first" onSave={handleSaveRecipients} />
        )}

        {/* 初回: 一通目を手紙の体裁で */}
        {firstRunStage === 'preview' && firstAnswer && hasRecipients && (
          <FirstLetterPreview
            answer={firstAnswer}
            recipients={recipients}
            onDone={() => setFirstRunStage(null)}
          />
        )}

        {/* 設定からの宛先編集 */}
        {isEditRecipientsOpen && (
          <OnboardingModal
            key="edit"
            isOpen
            mode="edit"
            initialRecipients={recipients}
            onSave={handleSaveRecipients}
            onClose={() => setIsEditRecipientsOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
