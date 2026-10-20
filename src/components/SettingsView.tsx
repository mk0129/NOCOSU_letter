import React, { useState, useRef } from 'react';
import { RecipientProfile } from '../types';
import {
  exportAllData,
  importAllData,
  clearAllData,
} from '../utils/storage';
import {
  Settings,
  Heart,
  Sparkles,
  Download,
  Upload,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Info,
  Check,
  AlertCircle,
  Phone,
} from 'lucide-react';

interface Props {
  recipient: RecipientProfile;
  onEditRecipient: () => void;
  onUpdateDeepToggle: (allowDeep: boolean) => void;
  onDataReset: () => void;
  onDataImported: () => void;
}

export const SettingsView: React.FC<Props> = ({
  recipient,
  onEditRecipient,
  onUpdateDeepToggle,
  onDataReset,
  onDataImported,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; msg: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle JSON export
  const handleExportJSON = () => {
    const jsonStr = exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nocosu-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle JSON file import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = importAllData(content);
        if (ok) {
          setImportStatus({ success: true, msg: 'データを正常に復元しました。' });
          onDataImported();
        } else {
          setImportStatus({
            success: false,
            msg: 'ファイルの読み込みに失敗しました。正しいJSONファイルかご確認ください。',
          });
        }
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle complete reset
  const handleConfirmReset = () => {
    if (deleteInputText === 'すべて消去') {
      clearAllData();
      setShowDeleteConfirm(false);
      onDataReset();
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="space-y-1 pt-1 border-b border-[#E6E0D2] pb-3">
        <h2 className="text-xl font-mincho font-bold text-[#2B2B2B]">
          設定
        </h2>
        <p className="text-xs text-[#6E685E]">
          宛先の変更、質問の設定、データの保存・復元
        </p>
      </div>

      {/* Recipient Profile Card */}
      <div className="washi-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#6E685E] tracking-wider uppercase">
            宛先の設定
          </span>
          <button
            type="button"
            onClick={onEditRecipient}
            className="text-xs font-medium text-[#2F4F6F] hover:underline cursor-pointer"
          >
            変更する
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#EAE0D0] flex items-center justify-center text-[#2F4F6F]">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-mincho font-bold text-[#2B2B2B]">
              {recipient.name}
            </h3>
            <p className="text-xs text-[#8E877D]">
              間柄: {recipient.relation}
              {recipient.ageGroup ? ` / 年齢帯: ${recipient.ageGroup}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Deep questions toggle */}
      <div className="washi-card rounded-2xl p-5 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="text-sm font-semibold text-[#2B2B2B] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#2F4F6F]" />
              深い質問（死や後悔）も含める
            </span>
            <p className="text-xs text-[#6E685E] leading-relaxed">
              人生の終盤、後悔、別れについての問い（全体の15%以下）を含めます。オフにすると、日常や思い出、仕事などの穏やかな問いのみが届きます。
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={recipient.allowDeep}
            onClick={() => onUpdateDeepToggle(!recipient.allowDeep)}
            className={`shrink-0 w-12 h-6.5 rounded-full transition-colors relative focus:outline-hidden ${
              recipient.allowDeep ? 'bg-[#2F4F6F]' : 'bg-[#D6CFC3]'
            }`}
          >
            <span
              className={`inline-block w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform absolute top-0.5 ${
                recipient.allowDeep ? 'translate-x-6 left-0.5' : 'translate-x-0.5 left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Data Backup & Restore */}
      <div className="washi-card rounded-2xl p-5 space-y-4">
        <span className="text-xs font-semibold text-[#6E685E] tracking-wider uppercase block">
          データの管理（保存と復元）
        </span>
        <p className="text-xs text-[#6E685E] leading-relaxed">
          あなたの言葉はすべてこの端末のブラウザ内（localStorage）に安全に保存されています。機種変更やバックアップの際はJSONファイルとして書き出してください。
        </p>

        {importStatus && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              importStatus.success
                ? 'bg-[#EAF5EA] text-[#285E28] border border-[#C5E2C5]'
                : 'bg-[#FAF0EA] text-[#A94420] border border-[#EACEC0]'
            }`}
          >
            {importStatus.success ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{importStatus.msg}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleExportJSON}
            className="py-2.5 px-3 bg-[#FCFAF6] hover:bg-[#EFE9DC] text-[#2B2B2B] text-xs font-medium rounded-xl border border-[#E5DDD0] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#2F4F6F]" />
            <span>JSONで書き出し</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-2.5 px-3 bg-[#FCFAF6] hover:bg-[#EFE9DC] text-[#2B2B2B] text-xs font-medium rounded-xl border border-[#E5DDD0] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#2F4F6F]" />
            <span>JSONから読み込み</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,application/json"
            className="hidden"
          />
        </div>
      </div>

      {/* Support Hotlines Section */}
      <div className="washi-card rounded-2xl p-5 space-y-3 bg-[#FAF5EC] border border-[#E8DFC9]">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-[#7A4B1F]" />
          <h3 className="text-sm font-semibold text-[#2B2B2B]">
            つらい気持ちのときは
          </h3>
        </div>
        <p className="text-xs text-[#6E685E] leading-relaxed">
          自分を振り返る問いかけの中で、悲しみや苦しさを感じたときは、一人で抱え込まず専門の窓口にご相談ください。
        </p>

        <div className="space-y-2 pt-1 text-xs text-[#524E48]">
          <div className="p-2.5 rounded-lg bg-white/70 border border-[#E5DDD0] flex items-center justify-between">
            <div>
              <span className="font-semibold block text-[#2B2B2B]">
                こころの健康相談統一ダイヤル
              </span>
              <span className="text-[#8E877D] text-[11px]">
                対応時間は自治体により異なります
              </span>
            </div>
            <a
              href="tel:0570-064-556"
              className="text-[#2F4F6F] font-bold text-sm tracking-wider hover:underline"
            >
              0570-064-556
            </a>
          </div>

          <div className="p-2.5 rounded-lg bg-white/70 border border-[#E5DDD0] flex items-center justify-between">
            <div>
              <span className="font-semibold block text-[#2B2B2B]">
                よりそいホットライン
              </span>
              <span className="text-[#8E877D] text-[11px]">
                24時間通話無料の相談窓口
              </span>
            </div>
            <a
              href="tel:0120-279-338"
              className="text-[#2F4F6F] font-bold text-sm tracking-wider hover:underline"
            >
              0120-279-338
            </a>
          </div>

          <div className="p-2.5 rounded-lg bg-white/70 border border-[#E5DDD0] flex items-center justify-between">
            <div>
              <span className="font-semibold block text-[#2B2B2B]">
                まもろうよ こころ（厚生労働省）
              </span>
              <span className="text-[#8E877D] text-[11px]">
                LINE・チャット等のSNS相談窓口
              </span>
            </div>
            <a
              href="https://www.mhlw.go.jp/mamorouyokokoro/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#2F4F6F] font-medium hover:underline text-xs"
            >
              <span>ウェブサイト</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Delete All Data */}
      <div className="washi-card rounded-2xl p-5 space-y-3 border-l-4 border-l-[#C05621]">
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-[#C05621]" />
          <h3 className="text-sm font-semibold text-[#2B2B2B]">
            すべての記録の消去
          </h3>
        </div>
        <p className="text-xs text-[#6E685E] leading-relaxed">
          この端末に保存されているすべての回答、宛先設定、編纂した手紙を完全に削除します。この操作は取り消せません。
        </p>

        {showDeleteConfirm ? (
          <div className="p-3.5 rounded-xl bg-[#FAF0EA] border border-[#EACEC0] space-y-3">
            <p className="text-xs text-[#A94420] font-medium">
              確認のため「すべて消去」と入力してください。
            </p>
            <input
              type="text"
              value={deleteInputText}
              onChange={(e) => setDeleteInputText(e.target.value)}
              placeholder="すべて消去"
              className="w-full px-3 py-2 bg-white border border-[#EACEC0] rounded-lg text-xs"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={deleteInputText !== 'すべて消去'}
                onClick={handleConfirmReset}
                className="flex-1 py-2 bg-[#C05621] disabled:bg-[#D9A690] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                完全に消去する
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInputText('');
                }}
                className="px-3 py-2 text-xs text-[#6E685E]"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="py-2 px-3 text-xs text-[#C05621] hover:bg-[#FAF0EA] border border-[#EACEC0] rounded-xl font-medium transition-colors"
          >
            データを全消去する
          </button>
        )}
      </div>

      {/* About App */}
      <div className="text-center text-xs text-[#8E877D] space-y-1 pt-4">
        <p className="font-mincho">NOCOSU（のこす）</p>
        <p>AIは本文を一文字も書かない、あなたのための記録帳</p>
      </div>
    </div>
  );
};
