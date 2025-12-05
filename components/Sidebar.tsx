import React from 'react';
import { Home, Users, Settings, Wrench, PenTool } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0 z-10">
      <div className="p-6 flex items-center space-x-2">
        <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
          宝
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">宝鉴 AI 分镜</span>
      </div>

      <div className="px-4 mb-4">
        <button 
            onClick={() => onChangeView('drafts')}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-lg flex items-center justify-center space-x-2 font-bold shadow-lg shadow-brand-500/20 transition-all"
        >
            <PenTool size={20} />
            <span>开始创作</span>
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        <button
            onClick={() => onChangeView('drafts')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentView === 'drafts' 
                ? 'bg-brand-50 text-brand-600 font-semibold' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
            <Home size={20} />
            <span>我的草稿</span>
        </button>

        <button
            onClick={() => onChangeView('characters')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentView === 'characters' 
                ? 'bg-brand-50 text-brand-600 font-semibold' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
            <Users size={20} />
            <span>主体库</span>
        </button>
        
        <div className="pt-4 mt-4 border-t border-gray-100">
             <button 
                onClick={() => onChangeView('settings')}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50"
             >
                <Settings size={20} />
                <span>系统设置</span>
             </button>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center">
        v2.0.0 BaoJian Storyboard
      </div>
    </div>
  );
};