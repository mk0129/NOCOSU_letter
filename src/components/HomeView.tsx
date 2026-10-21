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
  recipients: RecipientProfile[];
  todayState: TodayQuestionState | null;
  currentQuestion: QuestionItem | null;
  todayAnswer: AnswerItem | null;
  streakCount: number;
  /** 最後に封をした日（YYYY-MM-DD）。無ければ null */
  lastAnswerDate: string | null;
  totalAnswerCount: number;
  isLoadingQuestion: boolean;
  onAnswerClick: () => void;
  onChangeQuestionClick: () => void;
  onEditTodayAnswer: () => void;
}

export const HomeView: React.FC<Props> = ({
  recipients,
  todayState,
  currentQuestion,
  todayAnswer,
  lastAnswerDate,
  totalAnswerCount,
  isLoadingQuestion,
  onAnswerClick,
  onChangeQuestionClick,
  onEditTodayAnswer,
}) => {
  const single = recipients.length === 1 ? recipients[0] : null;
  const voiceName = single ? single.name : null;
  const recipientLabel = recipients.map((r) => r.name).join('・') || '大切な人';
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

      {/* 途切れを許す: 空いた日があっても責めない */}
      {(() => {
        if (!lastAnswerDate || todayAnswer) return null;
        const days = Math.floor((Date.now() - new Date(lastAnswerDate + 'T00:00:00').getTime()) / 86400000);
        if (days < 3) return null;
        return (
          <p className="text-xs text-[#6E685E] font-mincho text-center leading-relaxed">
            {days}日ぶりですね。空いた日のことは、気にしなくて大丈夫です。
          </p>
        );
      })()}

      {/* Recipient Ribbon */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF7F0] border border-[#E0D8CB] rounded-xl text-xs text-[#524E48]">
        <div className="flex items-center gap-2">
          <span>
            宛先: <strong className="text-[#2B2B2B] font-medium">{recipientLabel}</strong>
          </span>
          {single?.ageGroup && (
            <span className="text-[#8E877D]">（{single.ageGroup}）</span>
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
                {voiceName ? `${voiceName} より` : ''}
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
                      {voiceName ? `${voiceName}からの問い` : '今日の問い'}
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
                            {voiceName ? `${voiceName} より` : ''}
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
                              ? `${voiceName || '聞き手'}からの問い`
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
                        {voiceName ? `${voiceName} より` : ''}
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
      <div className="washi-card rounded-2xl p-5 flex items-center gap-5">
        {/* Visual Stack of Paper Sheets with 3D perspective & depth */}
        <div className="shrink-0 w-24 flex items-center justify-center">
          {totalAnswerCount === 0 ? (
            <svg
              width="88"
              height="64"
              viewBox="0 0 88 64"
              className="overflow-visible"
              aria-label="まだ手紙はありません"
            >
              {/* Soft base shadow */}
              <polygon
                points="16,44 58,34 74,48 32,58"
                fill="#EAE2D3"
                opacity="0.45"
              />
              {/* Dashed empty first letter outline in perspective */}
              <polygon
                points="14,40 56,30 72,44 30,54"
                fill="#FAF7F0"
                fillOpacity="0.5"
                stroke="#C8BFA8"
                strokeWidth="1.1"
                strokeDasharray="3 2.5"
              />
              {/* Faint envelope flap hint */}
              <polyline
                points="14,40 45,41 56,30"
                fill="none"
                stroke="#D6CFC3"
                strokeWidth="0.9"
                strokeDasharray="2 2"
              />
            </svg>
          ) : (
            (() => {
              const stackBaseHeight =
                visibleSheets * 2.4 + Math.ceil(extraThicknessLines * 0.55);
              const svgHeight = Math.max(68, Math.ceil(46 + stackBaseHeight));
              const baseBottomY = svgHeight - 10;

              const sheetTransforms = [
                { dx: 0, dy: 0, rot: -1.2 },
                { dx: 1.4, dy: -0.3, rot: 1.5 },
                { dx: -1.1, dy: 0.2, rot: -2.4 },
                { dx: 0.9, dy: -0.2, rot: 0.8 },
                { dx: -1.5, dy: 0.3, rot: 2.1 },
                { dx: 1.2, dy: 0, rot: -1.6 },
                { dx: -0.7, dy: -0.2, rot: 1.1 },
                { dx: 1.6, dy: 0.2, rot: -2.0 },
                { dx: -1.2, dy: 0, rot: 1.7 },
                { dx: 0.6, dy: -0.3, rot: -0.9 },
                { dx: -0.9, dy: 0.2, rot: 1.3 },
                { dx: 0.3, dy: 0, rot: -0.6 },
              ];

              const topSheetY =
                baseBottomY -
                extraThicknessLines * 0.55 -
                (visibleSheets - 1) * 2.4;

              return (
                <svg
                  width="92"
                  height={svgHeight}
                  viewBox={`0 0 92 ${svgHeight}`}
                  className="overflow-visible"
                  aria-label={`${totalAnswerCount}通の手紙の束`}
                >
                  {/* Ambient ground shadow beneath the stack */}
                  <polygon
                    points={`14,${baseBottomY - 8} 60,${baseBottomY - 19} 80,${baseBottomY - 3} 34,${baseBottomY + 8}`}
                    fill="#DFD6C5"
                    opacity="0.7"
                  />

                  {/* Compressed thickness block & edge lines when count > 12 */}
                  {Array.from({ length: extraThicknessLines }).map((_, i) => {
                    const layerY = baseBottomY - i * 0.55;
                    const jitter = ((i % 3) - 1) * 0.4;
                    return (
                      <g key={`thick-${i}`}>
                        <line
                          x1={14 + jitter}
                          y1={layerY - 11}
                          x2={33 + jitter}
                          y2={layerY + 4}
                          stroke={i % 2 === 0 ? '#C8BFA8' : '#DCD4C4'}
                          strokeWidth="0.65"
                        />
                        <line
                          x1={33 + jitter}
                          y1={layerY + 4}
                          x2={77 + jitter}
                          y2={layerY - 7}
                          stroke={i % 2 === 0 ? '#BEB49E' : '#D5CCB9'}
                          strokeWidth="0.65"
                        />
                      </g>
                    );
                  })}

                  {/* Up to 12 distinct overlapping angled letter sheets (drawn bottom to top) */}
                  {Array.from({ length: visibleSheets }).map((_, idx) => {
                    const layerY =
                      baseBottomY -
                      extraThicknessLines * 0.55 -
                      idx * 2.4;
                    const t = sheetTransforms[idx % sheetTransforms.length];
                    const isTop = idx === visibleSheets - 1;
                    const fillPalette = ['#FAF7F0', '#F6F1E6', '#FCF9F3'];
                    const sheetFill = isTop
                      ? '#FCFAF5'
                      : fillPalette[idx % fillPalette.length];

                    return (
                      <motion.g
                        key={`sheet-${idx}`}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.45,
                          delay: Math.min(idx * 0.035, 0.35),
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        transform={`translate(${t.dx}, ${t.dy}) rotate(${t.rot}, 46, ${layerY - 6})`}
                      >
                        <polygon
                          points={`14,${layerY - 10.2} 58,${layerY - 21.2} 77,${layerY - 6.2} 33,${layerY + 4.8}`}
                          fill="#D6CCB8"
                          opacity="0.45"
                        />
                        <polygon
                          points={`14,${layerY - 11} 58,${layerY - 22} 77,${layerY - 7} 33,${layerY + 4}`}
                          fill={sheetFill}
                          stroke="#2B2B2B"
                          strokeOpacity={isTop ? '0.6' : '0.32'}
                          strokeWidth={isTop ? '0.9' : '0.7'}
                          strokeLinejoin="round"
                        />
                        {isTop && (
                          <>
                            <polyline
                              points={`14,${layerY - 11} 47,${layerY - 9} 58,${layerY - 22}`}
                              fill="none"
                              stroke="#D8D0C1"
                              strokeWidth="0.75"
                            />
                            <line
                              x1="28"
                              y1={layerY - 8}
                              x2="54"
                              y2={layerY - 14.5}
                              stroke="#8E877D"
                              strokeOpacity="0.45"
                              strokeWidth="0.75"
                              strokeLinecap="round"
                            />
                            <line
                              x1="32"
                              y1={layerY - 4}
                              x2="50"
                              y2={layerY - 8.5}
                              stroke="#8E877D"
                              strokeOpacity="0.35"
                              strokeWidth="0.75"
                              strokeLinecap="round"
                            />
                          </>
                        )}
                      </motion.g>
                    );
                  })}

                  {/* Vermilion Koyori String wrapping the bundle when 3+ letters */}
                  {totalAnswerCount >= 3 && (
                    <g>
                      <path
                        d={`M 34,${topSheetY - 16.5} L 54,${topSheetY - 1.2} L 54,${baseBottomY - 1.5}`}
                        fill="none"
                        stroke="#B5443A"
                        strokeWidth="1.15"
                        strokeOpacity="0.85"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={`M 41,${topSheetY - 9} C 43,${topSheetY - 11.5} 47,${topSheetY - 11.5} 45,${topSheetY - 8.5} C 43,${topSheetY - 6} 47,${topSheetY - 6} 48.5,${topSheetY - 8.5}`}
                        fill="none"
                        stroke="#B5443A"
                        strokeWidth="1.1"
                        strokeLinecap="round"
                      />
                    </g>
                  )}

                  {totalAnswerCount > 0 && totalAnswerCount < 3 && (
                    <circle
                      cx="45"
                      cy={topSheetY - 9.5}
                      r="1.6"
                      fill="#B5443A"
                      opacity="0.85"
                    />
                  )}
                </svg>
              );
            })()
          )}
        </div>

        {/* Stack Copy & Progress Message */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-sans text-[#8E877D] tracking-wider">
              手紙の束
            </span>
            {totalAnswerCount > 0 && (
              <span className="text-[11px] font-mincho text-[#6E685E]">
                全 {totalAnswerCount} 通
              </span>
            )}
          </div>

          {totalAnswerCount === 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-mincho text-[#524E48] leading-relaxed">
                まだ一通も。今日の封筒から
              </p>
              <p className="text-[11px] text-[#8E877D] leading-relaxed">
                一通ずつ重ねた言葉が、ここに束ねられていきます。
              </p>
            </div>
          ) : totalAnswerCount < 52 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-mincho text-[#2B2B2B] leading-relaxed">
                {totalAnswerCount}通目まで。あと{52 - totalAnswerCount}通で一冊になります
              </p>
              <p className="text-[11px] text-[#6E685E] leading-relaxed">
                {totalAnswerCount === 1
                  ? '最初の一通が重なりました。無理のない歩幅で大丈夫です。'
                  : totalAnswerCount < 10
                  ? '少しずつ紙の厚みが生まれはじめています。'
                  : totalAnswerCount < 26
                  ? '季節の移ろいとともに、言葉の束が育っています。'
                  : '一冊の折り返しを過ぎ、確かな重みになってきました。'}
              </p>
              <div className="w-full h-[3px] bg-[#E8E0D2] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[#2B2B2B]/70 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(4, Math.round((totalAnswerCount / 52) * 100)))}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-mincho text-[#2B2B2B] leading-relaxed">
                一冊ぶんが揃いました。百通まであと{Math.max(0, 100 - totalAnswerCount)}通
              </p>
              <p className="text-[11px] text-[#6E685E] leading-relaxed">
                {totalAnswerCount >= 100
                  ? '百通の言葉が重なりました。いつでも手紙として束ねられます。'
                  : 'いつでも「束ねる」から一冊の手紙に仕立てることができます。'}
              </p>
              <div className="w-full h-[3px] bg-[#E8E0D2] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[#B5443A]/80 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((totalAnswerCount / 100) * 100))}%`,
                  }}
                />
              </div>
            </div>
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
