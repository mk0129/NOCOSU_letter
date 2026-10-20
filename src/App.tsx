import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RecipientProfile,
  QuestionItem,
  TodayQuestionState,
  AnswerItem,
} from './types';
import questionsData from './data/questions.json';
import {
  getRecipientProfile,
  saveRecipientProfile,
  getAnswers,
  saveAnswer,
  deleteAnswer as removeAnswer,
  getTodayQuestionState,
  saveTodayQuestionState,
  calculateStreak,
  getTodayDateString,
} from './utils/storage';
import { apiSelectQuestion } from './utils/api';
import { OnboardingModal } from './components/OnboardingModal';
import { BottomNav, NavTab } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { AnswerView } from './components/AnswerView';
import { HistoryView } from './components/HistoryView';
import { MirrorView } from './components/MirrorView';
import { LetterView } from './components/LetterView';
import { SettingsView } from './components/SettingsView';

const questionsBank: QuestionItem[] = questionsData as QuestionItem[];

export default function App() {
  // Recipient profile
  const [recipient, setRecipient] = useState<RecipientProfile | null>(() =>
    getRecipientProfile()
  );
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => !getRecipientProfile());
  const [isEditRecipientModal, setIsEditRecipientModal] = useState(false);

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

  // Today date string
  const todayDateStr = getTodayDateString();

  // Find question object by ID
  const currentQuestion = useMemo(() => {
    if (!todayState?.questionId) return null;
    return questionsBank.find((q) => q.id === todayState.questionId) || null;
  }, [todayState]);

  // Answer for today (if already answered)
  const todayAnswer = useMemo(() => {
    return answers.find((a) => a.date === todayDateStr) || null;
  }, [answers, todayDateStr]);

  // Streaks
  const streakCount = useMemo(() => calculateStreak(answers), [answers]);

  // Load or refresh today's question
  const ensureTodayQuestion = useCallback(
    async (targetRecipient: RecipientProfile, forceNew = false) => {
      const currentState = getTodayQuestionState();
      if (!forceNew && currentState && currentState.date === todayDateStr) {
        setTodayState(currentState);
        return;
      }

      setIsLoadingQuestion(true);
      try {
        const answeredIds = answers.map((a) => a.questionId);
        // Exclude current question if forceNew is requested
        if (forceNew && currentState?.questionId) {
          answeredIds.push(currentState.questionId);
        }

        const recentThemes = answers.slice(0, 5).map((a) => a.theme);

        const selected = await apiSelectQuestion(
          questionsBank,
          answeredIds,
          targetRecipient,
          targetRecipient.allowDeep,
          recentThemes
        );

        const newState: TodayQuestionState = {
          date: todayDateStr,
          questionId: selected.questionId,
          textForRecipient: selected.textForRecipient,
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

  // Initialize today's question on mount if recipient exists
  useEffect(() => {
    if (recipient) {
      ensureTodayQuestion(recipient);
    }
  }, [recipient, ensureTodayQuestion]);

  // Handle Onboarding Save
  const handleSaveProfile = (profile: RecipientProfile) => {
    saveRecipientProfile(profile);
    setRecipient(profile);
    setIsOnboardingOpen(false);
    setIsEditRecipientModal(false);
    // Refresh question with new recipient profile
    ensureTodayQuestion(profile);
  };

  // Change question (1 time per day)
  const handleChangeQuestion = () => {
    if (!recipient || todayState?.hasChangedToday) return;
    ensureTodayQuestion(recipient, true);
  };

  // Handle Save Answer
  const handleSaveAnswer = (saved: AnswerItem) => {
    saveAnswer(saved);
    setAnswers(getAnswers());
    setIsAnswering(false);
    setEditingAnswer(null);
  };

  // Handle Delete Answer
  const handleDeleteAnswer = (id: string) => {
    removeAnswer(id);
    setAnswers(getAnswers());
  };

  // Handle Reset All Data
  const handleDataReset = () => {
    setRecipient(null);
    setAnswers([]);
    setTodayState(null);
    setIsAnswering(false);
    setCurrentTab('home');
    setIsOnboardingOpen(true);
  };

  // Handle Data Imported
  const handleDataImported = () => {
    const prof = getRecipientProfile();
    setRecipient(prof);
    setAnswers(getAnswers());
    setTodayState(getTodayQuestionState());
    setCurrentTab('home');
  };

  return (
    <div className="min-h-screen bg-[#EFEAE0] flex justify-center py-0 md:py-6 text-[#2B2B2B]">
      {/* Mobile-first journal container */}
      <div className="w-full max-w-md min-h-screen md:min-h-[92vh] md:rounded-3xl bg-[#F4EFE6] border-0 md:border md:border-[#E5DFD3] shadow-none md:shadow-xl flex flex-col relative overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 px-4 md:px-6 pt-5 pb-6 overflow-y-auto">
          {isAnswering && currentQuestion && recipient ? (
            <AnswerView
              recipient={recipient}
              question={currentQuestion}
              todayState={todayState}
              existingAnswer={editingAnswer || todayAnswer}
              onSave={handleSaveAnswer}
              onCancel={() => {
                setIsAnswering(false);
                setEditingAnswer(null);
              }}
            />
          ) : (
            <>
              {currentTab === 'home' && recipient && (
                <HomeView
                  recipient={recipient}
                  todayState={todayState}
                  currentQuestion={currentQuestion}
                  todayAnswer={todayAnswer}
                  streakCount={streakCount}
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
                  onDeleteAnswer={handleDeleteAnswer}
                />
              )}

              {currentTab === 'mirror' && (
                <MirrorView answers={answers} />
              )}

              {currentTab === 'letter' && recipient && (
                <LetterView answers={answers} recipient={recipient} />
              )}

              {currentTab === 'settings' && recipient && (
                <SettingsView
                  recipient={recipient}
                  onEditRecipient={() => {
                    setIsEditRecipientModal(true);
                    setIsOnboardingOpen(true);
                  }}
                  onUpdateDeepToggle={(allowDeep) => {
                    const updated = { ...recipient, allowDeep, updatedAt: new Date().toISOString() };
                    saveRecipientProfile(updated);
                    setRecipient(updated);
                  }}
                  onDataReset={handleDataReset}
                  onDataImported={handleDataImported}
                />
              )}
            </>
          )}
        </main>

        {/* Bottom Navigation */}
        {!isAnswering && (
          <BottomNav
            currentTab={currentTab}
            onSelectTab={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* Onboarding / Edit Recipient Modal */}
        <OnboardingModal
          isOpen={isOnboardingOpen}
          initialProfile={recipient}
          isEditMode={isEditRecipientModal}
          onSave={handleSaveProfile}
          onClose={() => {
            if (recipient) {
              setIsOnboardingOpen(false);
              setIsEditRecipientModal(false);
            }
          }}
        />
      </div>
    </div>
  );
}
