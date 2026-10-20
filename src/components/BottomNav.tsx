import React from 'react';
import { Home, BookOpen, Sparkles, Mail, Settings } from 'lucide-react';

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
    { id: 'mirror', label: '鏡', icon: Sparkles },
    { id: 'letter', label: '手紙', icon: Mail },
    { id: 'settings', label: '設定', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F0]/95 backdrop-blur-md border-t border-[#E6E0D2] no-print">
      <div className="max-w-md mx-auto px-3 py-2 flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-xl ${
                isActive
                  ? 'text-[#2F4F6F] font-semibold'
                  : 'text-[#8E877D] hover:text-[#524E48]'
              }`}
            >
              <div
                className={`p-1.5 rounded-full transition-all ${
                  isActive ? 'bg-[#EAE0D0]/70 text-[#2F4F6F]' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
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
