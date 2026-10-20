import React from 'react';
import { Home, BookOpen, Quote, Mail, Settings } from 'lucide-react';

export type NavTab = 'home' | 'history' | 'mirror' | 'letter' | 'settings';

interface Props {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unreadCount?: number;
}

export const BottomNav: React.FC<Props> = ({ currentTab, onSelectTab }) => {
  const tabs: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'ホーム', icon: Home },
    { id: 'history', label: 'これまで', icon: BookOpen },
    { id: 'mirror', label: '鏡', icon: Quote },
    { id: 'letter', label: '手紙', icon: Mail },
    { id: 'settings', label: '設定', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F0]/95 backdrop-blur-md border-t border-[#E0D8CB] no-print">
      <div className="max-w-md mx-auto px-3 py-2 flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-xl cursor-pointer ${
                isActive
                  ? 'text-[#2B2B2B] font-medium'
                  : 'text-[#8E877D] hover:text-[#524E48]'
              }`}
            >
              <div
                className={`p-1.5 rounded-full transition-all ${
                  isActive ? 'bg-[#EAE0D0]/60 text-[#2B2B2B]' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2]' : 'stroke-[1.6]'}`} />
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight font-sans">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
