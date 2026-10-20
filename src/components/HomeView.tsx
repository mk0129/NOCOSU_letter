import React from 'react';
import {
  RecipientProfile,
  QuestionItem,
  TodayQuestionState,
  AnswerItem,
} from '../types';
import {
  Sparkles,
  RefreshCw,
  PenLine,
  CheckCircle2,
  Calendar,
  Flame,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { formatJapaneseDate } from '../utils/storage';

interface Props {
  recipient: RecipientProfile;
  todayState: TodayQuestionState | null;
  currentQuestion: QuestionItem | null;
  todayAnswer: AnswerItem | null;
  streakCount: number;
  totalAnswerCount: number;
  isLoadingQuestion: boolean;
  onAnswerClick: () => void;
  onChangeQuestionClick: () => void;
  onEditTodayAnswer: () => void;
}

export const HomeView: React.FC<Props> = ({
  recipient,
  todayState,
  currentQuestion,
  todayAnswer,
  streakCount,
  totalAnswerCount,
  isLoadingQuestion,
  onAnswerClick,
  onChangeQuestionClick,
  onEditTodayAnswer,
}) => {
  const isAnswered = !!todayAnswer;
  const hasChanged = todayState?.hasChangedToday ?? false;

  return (
    <div className="space-y-6 pb-24">
      {/* Header bar */}
      <header className="flex items-center justify-between pt-2 pb-1 border-b border-[#E6E0D2]">
        <div>
          <span className="text-[11px] tracking-widest text-[#8E877D] uppercase font-sans">
            大切な人へ、言葉をのこす
          </span>
          <h1 className="text-2xl font-mincho font-bold text-[#2B2B2B] tracking-wider">
            NOCOSU
          </h1>
        </div>

        {/* Streak / Count Pill */}
        <div className="flex items-center gap-2">
          {streakCount > 0 && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EFE4D6] border border-[#DDD0C0] text-[#7A4B1F] text-xs font-medium"
              title="連続して言葉をのこした日数"
            >
              <Flame className="w-3.5 h-3.5 text-[#C05621] fill-[#C05621]" />
              <span>{streakCount}日連続</span>
            </div>
          )}
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FAF5EC] border border-[#E5DFD3] text-[#524E48] text-xs"
            title="これまでにのこした言葉の総数"
          >
            <span>{totalAnswerCount}編の言葉</span>
          </div>
        </div>
      </header>

      {/* Recipient Ribbon */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF7F0] border border-[#E6E0D2] rounded-xl text-xs text-[#524E48]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2F4F6F]" />
          <span>宛先: <strong className="text-[#2B2B2B] font-semibold">{recipient.name}</strong></span>
          {recipient.ageGroup && (
            <span className="text-[#8E877D]">（{recipient.ageGroup}）</span>
          )}
        </div>
        <span className="text-[11px] text-[#8E877D]">
          {formatJapaneseDate(todayState?.date || '')}
        </span>
      </div>

      {/* Main Question / Answer Card */}
      {isAnswered ? (
        /* Completed Today's Answer State */
        <div className="washi-card rounded-2xl p-6 md:p-8 space-y-5 border-l-4 border-l-[#2F4F6F]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF0F6] text-[#2F4F6F] text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#2F4F6F]" />
              今日の言葉をのこしました
            </span>
            <span className="text-xs text-[#8E877D]">{todayAnswer.theme}</span>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-[#8E877D] tracking-wide block">
              {recipient.name}からの問い
            </span>
            <h3 className="text-lg font-mincho font-semibold text-[#2B2B2B] leading-relaxed">
              {todayAnswer.textForRecipient || todayAnswer.questionText}
            </h3>
            <p className="text-[11px] text-[#A49E93] font-sans">
              元の質問: {todayAnswer.questionText}
            </p>
          </div>

          {/* User's Answer Excerpt */}
          <div className="p-4 rounded-xl bg-[#F5EFE4]/80 border border-[#E5DDD0] space-y-2">
            <p className="text-sm text-[#2B2B2B] font-mincho leading-relaxed whitespace-pre-wrap line-clamp-4">
              {todayAnswer.text}
            </p>
            {todayAnswer.followUpQuestion && todayAnswer.followUpAnswer && (
              <div className="pt-2 border-t border-[#DDD3C2]/80 space-y-1">
                <span className="text-[11px] text-[#2F4F6F] font-semibold">
                  追い質問: {todayAnswer.followUpQuestion}
                </span>
                <p className="text-xs text-[#524E48] font-mincho italic line-clamp-2">
                  {todayAnswer.followUpAnswer}
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onEditTodayAnswer}
              className="flex-1 py-2.5 px-4 bg-[#2F4F6F] hover:bg-[#233B53] text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <PenLine className="w-4 h-4" />
              <span>今日の内容を書き直す・追記する</span>
            </button>
          </div>

          <p className="text-center text-xs text-[#8E877D] pt-2">
            また明日、新しい問いが届きます。焦らず、少しずつ。
          </p>
        </div>
      ) : (
        /* Today's Question Waiting For Answer */
        <div className="washi-card rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden">
          {isLoadingQuestion ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#2F4F6F]" />
              <p className="text-sm text-[#6E685E] font-mincho">
                今日の問いを選んでいます...
              </p>
            </div>
          ) : (
            <>
              {/* Question Theme & Depth Indicator */}
              <div className="flex items-center justify-between">
                <span className="inline-block px-3 py-1 rounded-full bg-[#EFE9DC] text-[#524E48] text-xs font-medium">
                  {currentQuestion?.theme || '日々のこと'}
                </span>
                {currentQuestion?.depth === 'deep' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F3E5D8] text-[#9C4221] text-[11px] font-medium">
                    <Sparkles className="w-3 h-3" />
                    深い問い
                  </span>
                )}
              </div>

              {/* Question Text */}
              <div className="space-y-2">
                <span className="text-xs text-[#8E877D] tracking-wide block">
                  {recipient.name}からの問い
                </span>
                <h2 className="text-xl md:text-2xl font-mincho font-bold text-[#2B2B2B] leading-relaxed">
                  {todayState?.textForRecipient || currentQuestion?.text}
                </h2>
                <p className="text-[11px] text-[#A49E93] leading-relaxed">
                  元の質問: {currentQuestion?.text}
                </p>
              </div>

              {/* Gemini Why Note (if available) */}
              {todayState?.why && (
                <div className="p-3 rounded-xl bg-[#FAF5EC] border border-[#E9E2D5] text-xs text-[#6E685E] flex items-start gap-2">
                  <span className="text-[#2F4F6F] shrink-0 font-semibold font-mincho">
                    案内
                  </span>
                  <span>{todayState.why}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={onAnswerClick}
                  className="w-full py-3.5 px-6 bg-[#2F4F6F] hover:bg-[#233B53] text-white font-medium rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <PenLine className="w-4 h-4" />
                  <span>この問いに答える</span>
                </button>

                <button
                  type="button"
                  disabled={hasChanged}
                  onClick={onChangeQuestionClick}
                  className={`w-full py-2.5 px-4 text-xs font-medium rounded-xl border transition-all flex items-center justify-center gap-2 ${
                    hasChanged
                      ? 'bg-[#EFE9DC]/50 text-[#A49E93] border-[#E0D8CB] cursor-not-allowed'
                      : 'bg-[#FCFAF6] text-[#6E685E] border-[#E5DFD3] hover:text-[#2B2B2B] hover:border-[#C4BCAB] cursor-pointer'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${hasChanged ? '' : 'text-[#2F4F6F]'}`} />
                  <span>
                    {hasChanged
                      ? '別の質問にする（本日は変更済みです）'
                      : '別の質問にする（1日1回）'}
                  </span>
                </button>
              </div>

              {/* Calming gentle note */}
              <div className="text-center pt-2">
                <p className="text-xs text-[#8E877D] leading-relaxed">
                  答えなくても大丈夫です。気が向いたときに、ひとことだけでも。
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* NOCOSUについて（1行の控えめな注記） */}
      <div className="text-center pt-1">
        <p className="text-[11px] text-[#A49E93]">
          NOCOSUについて: AIは本文を一文字も整えず、あなたの言葉をそのまま残します。
        </p>
      </div>
    </div>
  );
};
