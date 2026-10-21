import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RecipientProfile,
  QuestionItem,
  TodayQuestionState,
  AnswerItem,
  AppSettings,
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
import { OnboardingModal } from './components/OnboardingModal';
import { BottomNav, NavTab } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { AnswerView } from './components/AnswerView';
import { HistoryView } from './components/HistoryView';
import { MirrorView } from './components/MirrorView';
import { LetterView } from './components/LetterView';
import { SettingsView } from './components/SettingsView';
import { FirstLetterPreview } from './components/FirstLetterPreview';

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
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isAnswering, setIsAnswering] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState<AnswerItem | null>(null);

  // Answers & Today state
  const [answers, setAnswers] = useState<AnswerItem[]>(() => getAnswers());
  const [todayState, setTodayState] = useState<TodayQuestionState | null>(() =>
    getTodayQuestionState()
  );
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);

  const todayDateStr = getTodayDateString();

  const currentQuestion = useMemo(() => {
    if (!todayState?.questionId) return null;
    return questionsBank.find((q) => q.id === todayState.questionId) || null;
  }, [todayState]);

  const todayAnswer = useMemo(
    () => answers.find((a) => a.date === todayDateStr) || null,
    [answers, todayDateStr]
  );

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

  // 百通の地図から、今日の問いを自分で選ぶ（今日まだ封をしていないとき）
  const handlePickQuestion = (q: QuestionItem) => {
    if (todayAnswer) return;
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
    if (recipients.length === 0 || todayState?.hasChangedToday) return;
    ensureTodayQuestion(recipients, settings.allowDeep, true);
  };

  const handleSaveAnswer = (saved: AnswerItem) => {
    saveAnswer(saved);
    setAnswers(getAnswers());
    setIsAnswering(false);
    setEditingAnswer(null);
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
              todayState={editingAnswer ? editingTodayState : todayState}
              existingAnswer={editingAnswer}
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
                  todayState={todayState}
                  currentQuestion={currentQuestion}
                  todayAnswer={todayAnswer}
                  streakCount={streakCount}
                  lastAnswerDate={lastAnswerDate}
                  totalAnswerCount={answers.length}
                  isLoadingQuestion={isLoadingQuestion}
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
