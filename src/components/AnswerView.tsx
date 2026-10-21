import React, { useState, useEffect, useRef } from 'react';
import {
  RecipientProfile,
  QuestionItem,
  AnswerItem,
  TodayQuestionState,
  DialogueTurn,
  ReadWhen,
  READ_WHEN_OPTIONS,
} from '../types';
import { AudioRecorder } from '../utils/audioRecorder';
import { apiTranscribeAudio, apiFetchFollowUp } from '../utils/api';
import { getTodayDateString } from '../utils/storage';
import {
  Mic,
  Square,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  PenLine,
} from 'lucide-react';

interface Props {
  recipients: RecipientProfile[];
  question: QuestionItem;
  todayState: TodayQuestionState | null;
  existingAnswer?: AnswerItem | null;
  onSave: (answer: AnswerItem) => void;
  onCancel: () => void;
  /** 初回体験: 追い質問を省き、封をしたらすぐ完了する */
  skipFollowUp?: boolean;
  /** 初回体験: 宛先がまだ決まっていないときの見出し */
  firstRun?: boolean;
}

export const AnswerView: React.FC<Props> = ({
  recipients,
  question,
  todayState,
  existingAnswer,
  onSave,
  onCancel,
  skipFollowUp = false,
  firstRun = false,
}) => {
  // 宛先が1人なら、その人の声で。複数なら「聞き手」
  const single = recipients.length === 1 ? recipients[0] : null;
  const voiceName = single ? single.name : '聞き手';
  const recipient = single || recipients[0] || null;
  // 届け先（既定: 全員）。既存回答を書き足すときはその回答の届け先
  const [recipientIds, setRecipientIds] = useState<string[]>(() =>
    existingAnswer?.recipientIds?.length ? existingAnswer.recipientIds : recipients.map((r) => r.id)
  );
  const toggleRecipient = (id: string) =>
    setRecipientIds((prev) => (prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]));
  // Main Answer state
  const [text, setText] = useState(existingAnswer?.text || '');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState('');

  // Follow-up phase state
  const [stage, setStage] = useState<'main' | 'followup'>(
    existingAnswer?.followUpQuestion ? 'followup' : 'main'
  );
  const [followUpQuestion, setFollowUpQuestion] = useState(
    existingAnswer?.followUpQuestion || ''
  );
  const [followUpAnswer, setFollowUpAnswer] = useState(
    existingAnswer?.followUpAnswer || ''
  );
  const [isFollowUpRecording, setIsFollowUpRecording] = useState(false);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);

  // 聞き手モード: 済んだ往復（最大 MAX_TURNS）
  const MAX_TURNS = 5;
  const [dialogue, setDialogue] = useState<DialogueTurn[]>(() => {
    if (existingAnswer?.dialogue?.length) return existingAnswer.dialogue;
    if (existingAnswer?.followUpQuestion && existingAnswer?.followUpAnswer) {
      return [{ q: existingAnswer.followUpQuestion, a: existingAnswer.followUpAnswer }];
    }
    return [];
  });
  const [readWhen, setReadWhen] = useState<ReadWhen | undefined>(existingAnswer?.readWhen);

  // Audio Recorder instance
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    recorderRef.current = new AudioRecorder();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.cancel();
    };
  }, []);

  // Timer for recording
  useEffect(() => {
    if (isRecording || isFollowUpRecording) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingSeconds(0);
    }
  }, [isRecording, isFollowUpRecording]);

  // Handle main voice recording
  const handleToggleRecord = async () => {
    setTranscribeError('');
    if (!recorderRef.current) return;

    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setIsTranscribing(true);
      try {
        const audioBlob = await recorderRef.current.stop();
        const transcript = await apiTranscribeAudio(audioBlob);
        if (transcript.trim()) {
          setText((prev) => (prev ? `${prev}\n${transcript.trim()}` : transcript.trim()));
        }
      } catch (err: unknown) {
        const e = err as Error;
        setTranscribeError(e.message || '音声認識に失敗しました。');
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // Start recording
      try {
        await recorderRef.current.start();
        setIsRecording(true);
      } catch (err: unknown) {
        const e = err as Error;
        setTranscribeError(e.message || 'マイクの起動に失敗しました。');
      }
    }
  };

  // Handle follow-up voice recording
  const handleToggleFollowUpRecord = async () => {
    setTranscribeError('');
    if (!recorderRef.current) return;

    if (isFollowUpRecording) {
      setIsFollowUpRecording(false);
      setIsTranscribing(true);
      try {
        const audioBlob = await recorderRef.current.stop();
        const transcript = await apiTranscribeAudio(audioBlob);
        if (transcript.trim()) {
          setFollowUpAnswer((prev) =>
            prev ? `${prev}\n${transcript.trim()}` : transcript.trim()
          );
        }
      } catch (err: unknown) {
        const e = err as Error;
        setTranscribeError(e.message || '音声認識に失敗しました。');
      } finally {
        setIsTranscribing(false);
      }
    } else {
      try {
        await recorderRef.current.start();
        setIsFollowUpRecording(true);
      } catch (err: unknown) {
        const e = err as Error;
        setTranscribeError(e.message || 'マイクの起動に失敗しました。');
      }
    }
  };

  // Step 1: Save main answer -> Generate Follow-up
  const handleSaveMain = async () => {
    if (!text.trim()) {
      setTranscribeError('言葉を入力するか、マイクでお話しください。');
      return;
    }

    setTranscribeError('');

    // 初回体験: 追い質問なしでそのまま完了
    if (skipFollowUp) {
      handleComplete(false);
      return;
    }

    // 先に画面を進め、追い質問は裏で取りに行く（待たせない）
    setStage('followup');
    if (!followUpQuestion) {
      await fetchNextQuestion(dialogue);
    }
  };

  // 聞き手モード: これまでの往復を添えて、次の問いをもらう
  const fetchNextQuestion = async (turns: DialogueTurn[]) => {
    setIsGeneratingFollowUp(true);
    setFollowUpQuestion('');
    setFollowUpAnswer('');
    try {
      const transcript = turns.map((d) => `問い: ${d.q}\n答え: ${d.a}`).join('\n\n');
      const context = transcript ? `${text.trim()}\n\n【これまでの往復】\n${transcript}` : text.trim();
      const followUp = await apiFetchFollowUp(question.text, context, single);
      setFollowUpQuestion(followUp);
    } catch {
      setFollowUpQuestion('もう少し、詳しく聞かせてください。');
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  // 往復をひとつ閉じる。continueAsking なら次の問いへ、そうでなければ完了
  const handleTurn = async (continueAsking: boolean) => {
    const a = followUpAnswer.trim();
    const next = a && followUpQuestion ? [...dialogue, { q: followUpQuestion, a }] : dialogue;
    setDialogue(next);
    if (continueAsking && next.length < MAX_TURNS) {
      await fetchNextQuestion(next);
      return;
    }
    commit(next);
  };

  // Step 2: Finish and commit to localStorage
  const commit = (turns: DialogueTurn[]) => {
    const first = turns[0];
    const finalAnswer: AnswerItem = {
      id: existingAnswer?.id || `ans-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      questionId: question.id,
      questionText: question.text,
      textForRecipient: todayState?.textForRecipient || question.text,
      theme: question.theme,
      depth: question.depth,
      recipientIds,
      recipientName: recipients.filter((r) => recipientIds.includes(r.id)).map((r) => r.name).join('・') || recipient?.name || '大切な人',
      recipientRelation: recipient?.relation || 'other',
      date: todayState?.date || getTodayDateString(),
      createdAt: existingAnswer?.createdAt || new Date().toISOString(),
      text: text.trim(),
      followUpQuestion: first?.q,
      followUpAnswer: first?.a,
      dialogue: turns.length ? turns : undefined,
      readWhen,
    };
    onSave(finalAnswer);
  };

  // 互換: 初回体験など、追い質問なしで完了
  const handleComplete = (_withFollowUp: boolean) => {
    commit(dialogue);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs text-[#6E685E] hover:text-[#2B2B2B] transition-colors py-1.5 px-2.5 rounded-lg hover:bg-[#EFE9DC] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{firstRun ? '書かずに進む' : 'ホームへ戻る'}</span>
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[#8E877D] hover:text-[#524E48] transition-colors cursor-pointer"
        >
          答えなくてもいい（やめる）
        </button>
      </div>

      {/* Question Header Card */}
      <div className="washi-card rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between text-xs">
          {!firstRun && (<span className="px-2.5 py-0.5 rounded-full bg-[#EFE9DC] text-[#524E48] font-medium">{question.theme}</span>)}
          {!firstRun && single && <span className="text-[#8E877D]">宛先: {single.name}</span>}
        </div>

        <div className="space-y-1.5">
          <span className="text-xs text-[#8E877D] tracking-wide block">
            {firstRun
              ? 'はじめの一通'
              : todayState?.textForRecipient && todayState.textForRecipient !== question.text
                ? `${voiceName}からの問い`
                : '今日の問い'}
          </span>
          <h2 className="font-hand text-[1.5rem] font-normal text-[#2B2B2B] leading-relaxed">
            {todayState?.textForRecipient || question.text}
          </h2>
          <p className="text-[11px] text-[#A49E93] leading-relaxed">
            元の質問: {question.text}
          </p>
        </div>
      </div>

      {/* Main Text Input Area */}
      {stage === 'main' && (
        <div className="space-y-4">
          <div className="relative">
            <textarea
              rows={8}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (transcribeError) setTranscribeError('');
              }}
              placeholder={firstRun ? '思いつくままに。上手に書こうとせず、普段の言葉で。短くて大丈夫です...' : `思いつくままに。上手に書こうとせず、あなたの普段の言葉で大丈夫です...`}
              className="w-full p-5 bg-[#FAF7F0] border border-[#E0D8CB] rounded-2xl text-[#2B2B2B] placeholder-[#A49E93] font-mincho text-base leading-relaxed focus:outline-hidden focus:border-[#2B2B2B] transition-all resize-y"
            />

            {/* Character count & helpful note */}
            <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-[#8E877D]">
              <span>文字数の目安はありません。短くても長くても。</span>
              <span>{text.length} 文字</span>
            </div>
          </div>

          {/* Error Message */}
          {transcribeError && (
            <div className="p-3 rounded-xl bg-[#FAF0EA] border border-[#E0D8CB] text-xs text-[#A94420] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{transcribeError}</span>
            </div>
          )}

          {/* Voice Recording Control Bar */}
          <div className="p-4 rounded-xl bg-[#F5EFE4] border border-[#E0D8CB] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleToggleRecord}
                disabled={isTranscribing || isGeneratingFollowUp}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium transition-all cursor-pointer border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] ${
                  isRecording ? 'animate-pulse' : ''
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>録音を停止（{formatTimer(recordingSeconds)}）</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-[#2B2B2B]" />
                    <span>声で入力する（マイク）</span>
                  </>
                )}
              </button>

              {isTranscribing && (
                <div className="flex items-center gap-1.5 text-xs text-[#2B2B2B]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>話し言葉のまま文字にしています...</span>
                </div>
              )}
            </div>

            <span className="text-[11px] text-[#8E877D]">
              言い淀みや方言もそのまま残します
            </span>
          </div>

          {/* 届け先（宛先が複数のときだけ） */}
          {recipients.length > 1 && !firstRun && (
            <div className="space-y-2">
              <span className="text-[11px] text-[#8E877D] tracking-wide block">届ける相手</span>
              <div className="flex flex-wrap gap-1.5">
                {recipients.map((r) => {
                  const on = recipientIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRecipient(r.id)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all cursor-pointer ${
                        on
                          ? 'border-[#2B2B2B] bg-[#EFE9DC] text-[#2B2B2B]'
                          : 'border-[#E0D8CB] bg-transparent text-[#6E685E] hover:border-[#2B2B2B]/50'
                      }`}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seal / Submit Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSaveMain}
              disabled={isGeneratingFollowUp || isRecording || isTranscribing}
              className="w-full py-3.5 px-6 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 disabled:opacity-50 text-[#2B2B2B] font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {isGeneratingFollowUp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>封をしています...</span>
                </>
              ) : (
                <>
                  <PenLine className="w-4 h-4" />
                  <span>封をする</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 聞き手モード: 追い質問の往復（最大5） */}
      {stage === 'followup' && (
        <div className="space-y-5">
          {/* 本文 */}
          <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E0D8CB] space-y-1.5">
            <span className="text-[11px] text-[#8E877D] block">あなたがのこした言葉:</span>
            <p className="text-sm text-[#2B2B2B] font-mincho leading-relaxed whitespace-pre-wrap">
              {text}
            </p>
          </div>

          {/* 済んだ往復（逐語録） */}
          {dialogue.length > 0 && (
            <div className="space-y-3">
              {dialogue.map((d, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="text-sm font-hand text-[#524E48] leading-relaxed pl-1">
                    <span className="text-[10px] text-[#8E877D] mr-2">{voiceName}</span>
                    {d.q}
                  </p>
                  <p className="text-sm font-mincho text-[#2B2B2B] leading-relaxed whitespace-pre-wrap pl-4 border-l border-[#E0D8CB]">
                    {d.a}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* いまの問い */}
          <div className="washi-card rounded-2xl p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between text-xs text-[#8E877D]">
              <span>
                {dialogue.length === 0
                  ? `封をしたあと、${voiceName}がもう一つ聞いてきました`
                  : `${voiceName}が、さらに聞いてきました`}
              </span>
              <span>{dialogue.length + 1} / {MAX_TURNS}</span>
            </div>

            {isGeneratingFollowUp && !followUpQuestion ? (
              <div className="flex items-center gap-2 text-sm text-[#8E877D] font-mincho py-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#2B2B2B]" />
                <span>{voiceName}が、あなたの言葉を読んでいます…</span>
              </div>
            ) : (
              <h3 className="text-xl font-hand text-[#2B2B2B] leading-relaxed">{followUpQuestion}</h3>
            )}

            <p className="text-xs text-[#8E877D]">答えても、答えなくても大丈夫です。</p>

            <div className="pt-1 space-y-3">
              <textarea
                rows={4}
                value={followUpAnswer}
                onChange={(e) => setFollowUpAnswer(e.target.value)}
                placeholder="思い浮かんだことがあれば、自由に..."
                className="w-full p-4 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-[#2B2B2B] placeholder-[#A49E93] font-mincho text-sm leading-relaxed focus:outline-hidden focus:border-[#2B2B2B] transition-all resize-y"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleToggleFollowUpRecord}
                  disabled={isTranscribing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] ${
                    isFollowUpRecording ? 'animate-pulse' : ''
                  }`}
                >
                  {isFollowUpRecording ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      <span>停止（{formatTimer(recordingSeconds)}）</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-[#2B2B2B]" />
                      <span>声で答える</span>
                    </>
                  )}
                </button>
                {isTranscribing && (
                  <span className="text-xs text-[#2B2B2B] flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    文字にしています...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* いつ読んでほしいか */}
          <div className="space-y-2">
            <span className="text-[11px] text-[#8E877D] tracking-wide block">いつ読んでほしいか（任意）</span>
            <div className="flex flex-wrap gap-1.5">
              {READ_WHEN_OPTIONS.map((opt) => {
                const on = readWhen === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setReadWhen(on ? undefined : opt)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all cursor-pointer ${
                      on
                        ? 'border-[#2B2B2B] bg-[#EFE9DC] text-[#2B2B2B]'
                        : 'border-[#E0D8CB] bg-transparent text-[#6E685E] hover:border-[#2B2B2B]/50'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 操作 */}
          <div className="space-y-2.5 pt-1">
            {dialogue.length + 1 < MAX_TURNS && (
              <button
                type="button"
                onClick={() => handleTurn(true)}
                disabled={isFollowUpRecording || isTranscribing || isGeneratingFollowUp || !followUpAnswer.trim()}
                className="w-full py-3 px-6 border border-[#E0D8CB] hover:border-[#2B2B2B] disabled:opacity-40 bg-transparent text-[#2B2B2B] text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>答えて、もう一つ聞いてもらう</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleTurn(false)}
              disabled={isFollowUpRecording || isTranscribing}
              className="w-full py-3.5 px-6 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{followUpAnswer.trim() ? '答えて、今日はここまで' : '今日はここまでにする'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
