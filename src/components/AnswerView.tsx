import React, { useState, useEffect, useRef } from 'react';
import {
  RecipientProfile,
  QuestionItem,
  AnswerItem,
  TodayQuestionState,
} from '../types';
import { AudioRecorder } from '../utils/audioRecorder';
import { apiTranscribeAudio, apiFetchFollowUp } from '../utils/api';
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
  recipient: RecipientProfile;
  question: QuestionItem;
  todayState: TodayQuestionState | null;
  existingAnswer?: AnswerItem | null;
  onSave: (answer: AnswerItem) => void;
  onCancel: () => void;
}

export const AnswerView: React.FC<Props> = ({
  recipient,
  question,
  todayState,
  existingAnswer,
  onSave,
  onCancel,
}) => {
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

    setIsGeneratingFollowUp(true);
    setTranscribeError('');

    try {
      const followUp = await apiFetchFollowUp(
        question.text,
        text.trim(),
        recipient
      );
      setFollowUpQuestion(followUp);
      setStage('followup');
    } catch {
      setFollowUpQuestion('もう少し、詳しく聞かせてください。');
      setStage('followup');
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  // Step 2: Finish and commit to localStorage
  const handleComplete = (withFollowUp: boolean) => {
    const finalAnswer: AnswerItem = {
      id: existingAnswer?.id || `ans-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      questionId: question.id,
      questionText: question.text,
      textForRecipient: todayState?.textForRecipient || question.text,
      theme: question.theme,
      depth: question.depth,
      recipientName: recipient.name,
      recipientRelation: recipient.relation,
      date: todayState?.date || new Date().toISOString().split('T')[0],
      createdAt: existingAnswer?.createdAt || new Date().toISOString(),
      text: text.trim(),
      followUpQuestion: followUpQuestion || undefined,
      followUpAnswer: withFollowUp && followUpAnswer.trim() ? followUpAnswer.trim() : undefined,
    };

    onSave(finalAnswer);
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
          <span>ホームへ戻る</span>
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
          <span className="px-2.5 py-0.5 rounded-full bg-[#EFE9DC] text-[#524E48] font-medium">
            {question.theme}
          </span>
          <span className="text-[#8E877D]">宛先: {recipient.name}</span>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs text-[#8E877D] tracking-wide block">
            {recipient.name}からの問い
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
              placeholder={`${recipient.name}へ向けて、思いつくままに。上手に書こうとせず、あなたの普段の言葉で大丈夫です...`}
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

      {/* Follow-up Question Stage */}
      {stage === 'followup' && (
        <div className="space-y-6">
          {/* Main Answer Summary Pill */}
          <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#E0D8CB] space-y-1.5">
            <span className="text-[11px] text-[#8E877D] block">あなたがのこした言葉:</span>
            <p className="text-sm text-[#2B2B2B] font-mincho line-clamp-3 leading-relaxed">
              {text}
            </p>
          </div>

          {/* Follow-up Card */}
          <div className="washi-card rounded-2xl p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-2 text-xs text-[#8E877D]">
              <span>封をしたあと、{recipient.name}がもう一つ聞いてきました</span>
            </div>

            <h3 className="text-xl font-mincho font-medium text-[#2B2B2B] leading-relaxed">
              {followUpQuestion}
            </h3>

            <p className="text-xs text-[#8E877D]">
              この問いに答えても、答えなくても大丈夫です。
            </p>

            {/* Follow-up text area */}
            <div className="pt-2 space-y-3">
              <textarea
                rows={4}
                value={followUpAnswer}
                onChange={(e) => setFollowUpAnswer(e.target.value)}
                placeholder="思い浮かんだことがあれば、自由に書き添えてください..."
                className="w-full p-4 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-[#2B2B2B] placeholder-[#A49E93] font-mincho text-sm leading-relaxed focus:outline-hidden focus:border-[#2B2B2B] transition-all resize-y"
              />

              {/* Follow-up Mic Bar */}
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

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => handleComplete(true)}
              disabled={isFollowUpRecording || isTranscribing}
              className="w-full py-3.5 px-6 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <CheckCircle className="w-4 h-4" />
              <span>追い質問に答えて完了する</span>
            </button>

            <button
              type="button"
              onClick={() => handleComplete(false)}
              className="w-full py-3 px-4 bg-transparent hover:bg-[#2B2B2B]/5 text-[#524E48] text-sm font-medium rounded-xl border border-[#2B2B2B] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>今日はここまでにする</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
