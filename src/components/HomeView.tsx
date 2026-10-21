import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RecipientProfile,
  QuestionItem,
  TodayQuestionState,
  AnswerItem,
} from '../types';
import {
  RefreshCw,
  PenLine,
} from 'lucide-react';
import {
  formatJapaneseDate,
  formatPostmarkDate,
  getSolarTerm, getTrustee } from '../utils/storage';

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
  totalAnswerCount,
  isLoadingQuestion,
  onAnswerClick,
  onChangeQuestionClick,
  onEditTodayAnswer,
}) => {
  const [isOpened, setIsOpened] = useState(false);
  const [showAnsweredPreview, setShowAnsweredPreview] = useState(false);

  const isAnswered = !!todayAnswer;
  const hasChanged = todayState?.hasChangedToday ?? false;
  const targetDateStr = todayState?.date || todayAnswer?.date || '';
  const postmarkDate = formatPostmarkDate(targetDateStr);
  const solarTerm = getSolarTerm(targetDateStr);

  // Stack calculation: up to 12 distinct overlapping sheets, plus extra thickness lines beyond 12
  const visibleSheets = Math.min(totalAnswerCount, 12);
  const extraThicknessLines = Math.min(Math.max(0, totalAnswerCount - 12), 40);

  return (
    <div className="space-y-6 pb-24">
      {/* Header bar (pills removed) */}
      <header className="flex items-center justify-between pt-2 pb-1 border-b border-[#E0D8CB]">
        <div>
          <span className="text-[11px] tracking-widest text-[#8E877D] uppercase font-sans">
            大切な人へ、言葉をのこす
          </span>
          <h1 className="text-2xl font-mincho font-medium text-[#2B2B2B] tracking-wider">
            NOCOSU
          </h1>
        </div>
      </header>

      {/* Recipient Ribbon */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF7F0] border border-[#E0D8CB] rounded-xl text-xs text-[#524E48]">
        <div className="flex items-center gap-2">
          <span>
            宛先: <strong className="text-[#2B2B2B] font-medium">{recipient.name}</strong>
          </span>
          {recipient.ageGroup && (
            <span className="text-[#8E877D]">（{recipient.ageGroup}）</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 border border-[#B5443A] text-[#B5443A] text-[10px] font-mincho font-medium rounded-xs tracking-wider leading-none select-none">
            今日
          </span>
          <span className="text-[11px] text-[#8E877D]">
            {formatJapaneseDate(targetDateStr)}
          </span>
        </div>
      </div>

      {/* Main Envelope Area */}
      {isAnswered && todayAnswer ? (
        /* Answered State: Envelope with Vermilion Koyori (紙縒り) that unties/ties on toggle */
        <div className="space-y-4">
          <div
            onClick={() => setShowAnsweredPreview((prev) => !prev)}
            style={{ perspective: '1200px' }}
            className="relative w-full min-h-[228px] bg-[#FAF7F0] border border-[#E0D8CB] rounded-2xl overflow-hidden cursor-pointer select-none flex flex-col justify-between p-5 transition-colors hover:border-[#2B2B2B]/40"
          >
            {/* Subtle diagonal bottom pocket lines */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 400 228"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="228"
                x2="160"
                y2="128"
                stroke="#E0D8CB"
                strokeWidth="1"
              />
              <line
                x1="400"
                y1="228"
                x2="240"
                y2="128"
                stroke="#E0D8CB"
                strokeWidth="1"
              />
            </svg>

            {/* Top Washi Flap with soft curved apex */}
            <motion.div
              initial={false}
              animate={{
                rotateX: showAnsweredPreview ? 174 : 0,
                y: showAnsweredPreview ? -6 : 0,
                scaleY: showAnsweredPreview ? 0.92 : 1,
                opacity: showAnsweredPreview ? 0.35 : 1,
              }}
              transition={{
                duration: 0.95,
                delay: showAnsweredPreview ? 0.18 : 0,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ transformOrigin: 'top center' }}
              className="absolute top-0 left-0 right-0 h-[134px] pointer-events-none z-10"
            >
              <svg
                className="w-full h-full"
                viewBox="0 0 400 134"
                preserveAspectRatio="none"
              >
                <path
                  d="M 0,0 L 400,0 L 212,123 Q 200,130 188,123 Z"
                  fill="#F4EFE6"
                  stroke="#E0D8CB"
                  strokeWidth="1.2"
                />
              </svg>
            </motion.div>

            {/* Top-Right Circular Postmark (Date + 24 Solar Term) */}
            <div className="relative z-20 flex justify-end">
              <div
                className="w-14 h-14 rounded-full border border-[#8E877D] bg-[#FAF7F0]/90 flex flex-col items-center justify-center text-[#524E48] -rotate-6"
                title={`消印: ${postmarkDate} / 二十四節気: ${solarTerm}`}
              >
                <span className="text-[10px] font-sans tracking-tighter leading-none">
                  {postmarkDate}
                </span>
                <span className="w-8 border-t border-[#8E877D]/60 my-1" />
                <span className="text-[11px] font-mincho font-medium tracking-widest leading-none">
                  {solarTerm}
                </span>
              </div>
            </div>

            {/* Center Flap Closure: Vermilion Koyori (朱色の紙縒り) tying animation */}
            <div className="relative z-20 flex flex-col items-center justify-center my-1 pointer-events-none">
              <svg
                width="76"
                height="44"
                viewBox="0 0 76 44"
                className="overflow-visible"
                aria-label="朱色の紙縒り"
              >
                {/* Vertical anchor thread passing through the flap tip */}
                <motion.path
                  d="M 38,6 C 37.5,16 38.5,26 38,36"
                  fill="none"
                  stroke="#B5443A"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: showAnsweredPreview ? 0 : 1,
                    opacity: showAnsweredPreview ? 0 : 0.85,
                  }}
                  transition={{
                    duration: showAnsweredPreview ? 0.25 : 0.5,
                    delay: showAnsweredPreview ? 0 : 0.35,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
                {/* Graceful hand-tied Koyori knot & flowing ends */}
                <motion.path
                  d="M 14,29 C 22,27 29,14 36,16 C 42,18 41,26 35,25 C 29,24 33,14 40,16 C 46,18 45,26 39,24 C 45,24 53,27 62,30"
                  fill="none"
                  stroke="#B5443A"
                  strokeWidth="1.45"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: showAnsweredPreview ? 0 : 1,
                    opacity: showAnsweredPreview ? 0 : 1,
                  }}
                  transition={{
                    duration: showAnsweredPreview ? 0.3 : 0.85,
                    delay: showAnsweredPreview ? 0 : 0.5,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </svg>
              <motion.span
                initial={false}
                animate={{ opacity: showAnsweredPreview ? 0 : 1 }}
                transition={{ duration: 0.4, delay: showAnsweredPreview ? 0 : 0.7 }}
                className="text-[11px] text-[#8E877D] font-mincho tracking-wider"
              >
                本日の手紙を結びました
              </motion.span>
            </div>

            {/* Bottom-Left From Recipient */}
            <div className="relative z-20 flex items-end justify-between pt-2">
              <span className="font-hand text-base text-[#2B2B2B] tracking-wide">
                {recipient.name} より
              </span>
              <span className="text-[11px] text-[#8E877D]">
                {showAnsweredPreview ? 'タップして封を閉じる' : todayAnswer.theme}
              </span>
            </div>
          </div>

          {/* Expandable Preview of Today's Question & Reply */}
          <AnimatePresence>
            {showAnsweredPreview && (
              <motion.div
                initial={{ y: 20, height: 0, opacity: 0 }}
                animate={{ y: 0, height: 'auto', opacity: 1 }}
                exit={{ y: 12, height: 0, opacity: 0 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="washi-card rounded-2xl p-5 space-y-3">
                  <div className="space-y-1">
                    <span className="text-xs text-[#8E877D] block">
                      {recipient.name}からの問い
                    </span>
                    <h3 className="font-hand text-[1.5rem] font-normal text-[#2B2B2B] leading-relaxed">
                      {todayAnswer.textForRecipient || todayAnswer.questionText}
                    </h3>
                    <p className="text-[11px] text-[#A49E93] font-sans">
                      元の質問: {todayAnswer.questionText}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#F4EFE6]/80 border border-[#E0D8CB] space-y-2">
                    <p className="text-sm text-[#2B2B2B] font-mincho leading-relaxed whitespace-pre-wrap">
                      {todayAnswer.text}
                    </p>
                    {todayAnswer.followUpQuestion && todayAnswer.followUpAnswer && (
                      <div className="pt-2 border-t border-[#E0D8CB] space-y-1">
                        <span className="text-[11px] text-[#524E48] font-medium block">
                          追い質問: {todayAnswer.followUpQuestion}
                        </span>
                        <p className="text-xs text-[#524E48] font-mincho whitespace-pre-wrap">
                          {todayAnswer.followUpAnswer}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button: 今日の返事を読む・書き足す */}
          <button
            type="button"
            onClick={onEditTodayAnswer}
            className="w-full py-3.5 px-6 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <PenLine className="w-4 h-4" />
            <span>今日の返事を読む・書き足す</span>
          </button>
        </div>
      ) : (
        /* Unanswered State: Interactive Washi Envelope with Koyori (紙縒り) */
        <div className="space-y-3">
          {isLoadingQuestion ? (
            <div className="washi-card rounded-2xl py-16 px-6 text-center space-y-3">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#2B2B2B]" />
              <p className="text-sm text-[#6E685E] font-mincho">
                今日の問いを選んでいます...
              </p>
            </div>
          ) : (
            <>
              <div className="relative pt-2">
                {/* Envelope Container */}
                <div
                  onClick={() => {
                    if (!isOpened) setIsOpened(true);
                  }}
                  role={!isOpened ? 'button' : undefined}
                  tabIndex={!isOpened ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (!isOpened && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setIsOpened(true);
                    }
                  }}
                  style={{ perspective: '1200px' }}
                  className={`relative w-full bg-[#FAF7F0] border border-[#E0D8CB] rounded-2xl transition-all duration-700 ${
                    !isOpened
                      ? 'min-h-[240px] cursor-pointer hover:border-[#2B2B2B]/50 overflow-hidden p-5 flex flex-col justify-between'
                      : 'pt-6 pb-5 px-4 md:px-6 overflow-hidden'
                  }`}
                >
                  {/* Envelope Diagonal Pocket Lines (background) */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 400 240"
                    preserveAspectRatio="none"
                  >
                    <line
                      x1="0"
                      y1="240"
                      x2="160"
                      y2="130"
                      stroke="#E0D8CB"
                      strokeWidth="1"
                    />
                    <line
                      x1="400"
                      y1="240"
                      x2="240"
                      y2="130"
                      stroke="#E0D8CB"
                      strokeWidth="1"
                    />
                  </svg>

                  {/* Top Washi Triangular Flap with soft floating motion */}
                  <motion.div
                    initial={false}
                    animate={{
                      rotateX: isOpened ? 160 : 0,
                      y: isOpened ? 0 : 0,
                      scaleY: isOpened ? 0.92 : 1,
                      opacity: isOpened ? 0.32 : 1,
                    }}
                    transition={{
                      duration: 0.95,
                      delay: isOpened ? 0.16 : 0,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{ transformOrigin: 'top center' }}
                    className="absolute top-0 left-0 right-0 h-[136px] pointer-events-none z-20"
                  >
                    <svg
                      className="w-full h-full"
                      viewBox="0 0 400 136"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M 0,0 L 400,0 L 212,125 Q 200,132 188,125 Z"
                        fill="#F4EFE6"
                        stroke="#E0D8CB"
                        strokeWidth="1.2"
                      />
                    </svg>
                  </motion.div>

                  {/* Top-Right Circular Postmark (Date + 24 Solar Term) */}
                  <div className="relative z-30 flex justify-end pointer-events-none">
                    <div
                      className="w-14 h-14 rounded-full border border-[#8E877D] bg-[#FAF7F0]/95 flex flex-col items-center justify-center text-[#524E48] -rotate-6"
                      title={`消印: ${postmarkDate} / 二十四節気: ${solarTerm}`}
                    >
                      <span className="text-[10px] font-sans tracking-tighter leading-none">
                        {postmarkDate}
                      </span>
                      <span className="w-8 border-t border-[#8E877D]/60 my-1" />
                      <span className="text-[11px] font-mincho font-medium tracking-widest leading-none">
                        {solarTerm}
                      </span>
                    </div>
                  </div>

                  {/* Vermilion Koyori (朱色の紙縒り) on Flap Closure: ties when closed, unties when opened */}
                  <div className="relative z-30 flex flex-col items-center justify-center pointer-events-none">
                    <svg
                      width="76"
                      height={isOpened ? '12' : '44'}
                      viewBox="0 0 76 44"
                      className="overflow-visible transition-all duration-500"
                      aria-label="朱色の紙縒り"
                    >
                      {/* Vertical thread passing through the flap fold */}
                      <motion.path
                        d="M 38,6 C 37.5,16 38.5,26 38,36"
                        fill="none"
                        stroke="#B5443A"
                        strokeWidth="1.25"
                        strokeLinecap="round"
                        initial={false}
                        animate={{
                          pathLength: isOpened ? 0 : 1,
                          opacity: isOpened ? 0 : 0.85,
                        }}
                        transition={{
                          duration: isOpened ? 0.25 : 0.5,
                          delay: isOpened ? 0 : 0.35,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                      {/* Hand-tied Koyori knot & flowing ends */}
                      <motion.path
                        d="M 14,29 C 22,27 29,14 36,16 C 42,18 41,26 35,25 C 29,24 33,14 40,16 C 46,18 45,26 39,24 C 45,24 53,27 62,30"
                        fill="none"
                        stroke="#B5443A"
                        strokeWidth="1.45"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={false}
                        animate={{
                          pathLength: isOpened ? 0 : 1,
                          opacity: isOpened ? 0 : 1,
                        }}
                        transition={{
                          duration: isOpened ? 0.3 : 0.85,
                          delay: isOpened ? 0 : 0.5,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                    </svg>
                  </div>

                  {/* Closed Envelope Prompt vs Softly Floating Risen Washi Card */}
                  <AnimatePresence mode="wait">
                    {!isOpened ? (
                      <motion.div
                        key="closed-prompt"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                        className="relative z-30 flex flex-col justify-between pt-2"
                      >
                        <div className="text-center pb-3">
                          <span className="text-xs font-mincho text-[#6E685E] tracking-widest">
                            タップして紙縒りをほどく
                          </span>
                        </div>

                        {/* Bottom-Left: {宛先の呼び名} より */}
                        <div className="flex items-end justify-between pt-2">
                          <span className="font-hand text-base text-[#2B2B2B] tracking-wide">
                            {recipient.name} より
                          </span>
                          <span className="text-[11px] text-[#8E877D]">
                            {currentQuestion?.theme || '日々のこと'}
                          </span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="opened-card"
                        initial={{ y: 38, opacity: 0, scale: 0.985 }}
                        animate={{ y: -6, opacity: 1, scale: 1 }}
                        exit={{ y: 28, opacity: 0, scale: 0.985, transition: { duration: 0.35 } }}
                        transition={{
                          delay: 0.26,
                          duration: 0.85,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="relative z-30 mt-1 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl p-5 md:p-6 space-y-5"
                      >
                        {/* Theme & Close Flap Trigger */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-block px-3 py-1 rounded-full bg-[#EFE9DC] text-[#524E48] text-xs font-medium">
                              {currentQuestion?.theme || '日々のこと'}
                            </span>
                            {currentQuestion?.depth === 'deep' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFE9DC] text-[#524E48] text-[11px] font-medium">
                                深い問い
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsOpened(false);
                            }}
                            className="text-[11px] font-mincho text-[#8E877D] hover:text-[#2B2B2B] transition-colors cursor-pointer"
                          >
                            封を閉じる
                          </button>
                        </div>

                        {/* Question Text (.font-hand) */}
                        <div className="space-y-2">
                          <span className="text-xs text-[#8E877D] tracking-wide block">
                            {todayState?.textForRecipient && todayState.textForRecipient !== currentQuestion?.text
                              ? `${recipient.name}からの問い`
                              : '今日の問い'}
                          </span>
                          <h2 className="font-hand text-[1.5rem] font-normal text-[#2B2B2B] leading-relaxed">
                            {todayState?.textForRecipient || currentQuestion?.text}
                          </h2>
                          <p className="text-[11px] text-[#A49E93] leading-relaxed">
                            元の質問: {currentQuestion?.text}
                          </p>
                        </div>

                        {/* Gemini Why Note (if available) */}
                        {todayState?.why && (
                          <div className="p-3 rounded-xl bg-[#F4EFE6] border border-[#E0D8CB] text-xs text-[#6E685E] flex items-start gap-2">
                            <span className="text-[#2B2B2B] shrink-0 font-medium font-mincho">
                              案内
                            </span>
                            <span>{todayState.why}</span>
                          </div>
                        )}

                        {/* Write Reply Button (墨の線のボタン) */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAnswerClick();
                            }}
                            className="w-full py-3.5 px-6 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                          >
                            <PenLine className="w-4 h-4" />
                            <span>返事を書く</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Keep '{宛先の呼び名} より' visible at bottom-left of envelope even after opening */}
                  {isOpened && (
                    <div className="relative z-30 flex items-center justify-between pt-2 px-1">
                      <span className="font-hand text-sm text-[#524E48] tracking-wide">
                        {recipient.name} より
                      </span>
                      <span className="text-[11px] text-[#8E877D]">
                        答えなくても大丈夫です
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Small '別の質問にする（1日1回）' below the envelope */}
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  disabled={hasChanged}
                  onClick={() => {
                    onChangeQuestionClick();
                  }}
                  className={`py-1.5 px-3.5 text-[11px] rounded-lg border transition-all inline-flex items-center gap-1.5 ${
                    hasChanged
                      ? 'bg-transparent text-[#A49E93] border-transparent cursor-not-allowed'
                      : 'bg-transparent text-[#6E685E] border-[#E0D8CB] hover:border-[#2B2B2B] hover:text-[#2B2B2B] cursor-pointer'
                  }`}
                >
                  <RefreshCw
                    className={`w-3 h-3 ${
                      hasChanged ? 'text-[#A49E93]' : 'text-[#6E685E]'
                    }`}
                  />
                  <span>
                    {hasChanged
                      ? '別の質問にする（本日は変更済みです）'
                      : '別の質問にする（1日1回）'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 手紙の束 (Stack of Letters) below the envelope */}
      <div className="washi-card rounded-2xl p-4 flex items-center gap-4">
        {/* Visual Stack of Paper Sheets (max 12 distinct sheets + thickness lines beyond 12) */}
        <div className="shrink-0 w-16 flex items-center justify-center">
          {totalAnswerCount === 0 ? (
            <svg
              width="52"
              height="36"
              viewBox="0 0 52 36"
              className="overflow-visible"
              aria-hidden="true"
            >
              <rect
                x="6"
                y="8"
                width="40"
                height="22"
                rx="2"
                fill="none"
                stroke="#D6CFC3"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            </svg>
          ) : (
            <svg
              width="56"
              height={Math.max(40, 24 + visibleSheets * 2 + Math.ceil(extraThicknessLines * 0.6))}
              viewBox={`0 0 56 ${Math.max(40, 24 + visibleSheets * 2 + Math.ceil(extraThicknessLines * 0.6))}`}
              className="overflow-visible"
              aria-label={`${totalAnswerCount}通の手紙の束`}
            >
              {/* Extra thickness lines at the bottom when count > 12 */}
              {Array.from({ length: extraThicknessLines }).map((_, i) => {
                const yPos = 22 + visibleSheets * 2 + (extraThicknessLines - i) * 0.6;
                const xOffset = ((i % 3) - 1) * 0.6;
                return (
                  <line
                    key={`thick-${i}`}
                    x1={8 + xOffset}
                    y1={yPos}
                    x2={48 + xOffset}
                    y2={yPos}
                    stroke="#C8BFA8"
                    strokeWidth="0.7"
                  />
                );
              })}

              {/* Up to 12 slightly offset overlapping paper sheets (drawn bottom to top) */}
              {Array.from({ length: visibleSheets }).map((_, idx) => {
                const reverseIdx = visibleSheets - 1 - idx;
                const offsets = [-1.5, 1.0, -0.8, 1.4, -0.4, 0.9, -1.2, 0.6, -0.9, 1.2, -0.5, 0.3];
                const dx = offsets[idx % offsets.length];
                const y = 4 + reverseIdx * 2;
                return (
                  <g key={`sheet-${idx}`}>
                    <rect
                      x={8 + dx}
                      y={y}
                      width="40"
                      height="18"
                      rx="1.5"
                      fill="#FAF7F0"
                      stroke="#2B2B2B"
                      strokeOpacity="0.45"
                      strokeWidth="0.8"
                    />
                    {idx === visibleSheets - 1 && (
                      <line
                        x1={14 + dx}
                        y1={y + 6}
                        x2={34 + dx}
                        y2={y + 6}
                        stroke="#E0D8CB"
                        strokeWidth="0.8"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Stack Copy */}
        <div className="flex-1 min-w-0">
          {totalAnswerCount === 0 ? (
            <p className="text-xs font-mincho text-[#524E48] leading-relaxed">
              まだ一通も。今日の封筒から
            </p>
          ) : totalAnswerCount < 52 ? (
            <p className="text-xs font-mincho text-[#2B2B2B] leading-relaxed">
              {totalAnswerCount}通目まで。あと{52 - totalAnswerCount}通で一冊になります
            </p>
          ) : (
            <p className="text-xs font-mincho text-[#2B2B2B] leading-relaxed">
              一冊ぶんが揃いました。百通まであと{Math.max(0, 100 - totalAnswerCount)}通
            </p>
          )}
        </div>
      </div>

      {/* 託す人 */}
      {getTrustee() && (
        <p className="text-[11px] text-[#8E877D] text-center">
          託す人: <span className="text-[#2B2B2B]">{getTrustee()?.name}</span>
        </p>
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
