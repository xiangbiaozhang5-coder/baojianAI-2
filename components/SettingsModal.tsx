import React, { useState, useEffect } from 'react';
import { Settings, GenerationModel, TEXT_MODELS } from '../types';
import { Button } from './Button';
import { X, Save, Activity, Key, Globe, Palette, CreditCard } from 'lucide-react';
import { storage } from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

const THEME_COLORS = [
  { name: '活力橙', value: '#f97316' },
  { name: '科技蓝', value: '#3b82f6' },
  { name: '赛博紫', value: '#8b5cf6' },
  { name: '极光绿', value: '#10b981' },
  { name: '未来青', value: '#06b6d4' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [localSettings, setLocalSettings] = useState<Settings>(storage.getSettings());

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(storage.getSettings());
    }
  }, [isOpen]);

  const handleSave = () => {
    storage.saveSettings(localSettings);
    onSave(localSettings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-xl text-gray-800">系统设置</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Theme & Appearance */}
          <div className="space-y-4 border-b border-gray-100 pb-6">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <Palette size={18} className="text-[var(--brand-color)]" /> 主题外观
            </h4>
            <div className="flex gap-4">
                {THEME_COLORS.map(color => (
                    <button
                        key={color.value}
                        onClick={() => setLocalSettings({...localSettings, themeColor: color.value})}
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${localSettings.themeColor === color.value ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                    >
                        {localSettings.themeColor === color.value && <div className="w-3 h-3 bg-white rounded-full" />}
                    </button>
                ))}
            </div>
          </div>

          {/* API Configuration */}
          <div className="space-y-4 border-b border-gray-100 pb-6">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Activity size={18} className="text-[var(--brand-color)]" /> API 配置
                </h4>
                <a 
                    href={localSettings.baseUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full flex items-center gap-1 font-bold transition-colors"
                >
                    <CreditCard size={12} /> 测试地址连通性
                </a>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Key size={14} /> API Key
                    </label>
                    <input 
                        type="password" 
                        value={localSettings.apiKey}
                        onChange={e => setLocalSettings({...localSettings, apiKey: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-color)] outline-none"
                        placeholder="sk-..."
                    />
                    <p className="text-xs text-gray-500 mt-1">请输入您的 Gemini API Key</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Globe size={14} /> Base URL (API 代理地址)
                    </label>
                    <input 
                        type="text" 
                        value={localSettings.baseUrl}
                        onChange={e => setLocalSettings({...localSettings, baseUrl: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-color)] outline-none"
                        placeholder="例如: https://generativelanguage.googleapis.com 或您的代理地址"
                    />
                    <p className="text-xs text-gray-500 mt-1">留空则使用默认。请确保地址包含协议头 (如 https://)。</p>
                </div>
            </div>
          </div>

          {/* Models */}
          <div className="space-y-4 border-b border-gray-100 pb-6">
            <h4 className="font-semibold text-gray-900">模型选择</h4>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">推理/文本模型</label>
                    <select 
                        value={localSettings.textModel}
                        onChange={e => setLocalSettings({...localSettings, textModel: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                        {TEXT_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">生图模型</label>
                    <select 
                        value={localSettings.imageModel}
                        onChange={e => setLocalSettings({...localSettings, imageModel: e.target.value as GenerationModel})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                        <option value={GenerationModel.NANOBANANA}>NanoBanana (Fast)</option>
                        <option value={GenerationModel.NANOBANANA_PRO}>NanoBanana Pro (Quality)</option>
                    </select>
                </div>
            </div>
          </div>

          {/* Paths */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">路径配置</h4>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">剪映草稿路径</label>
                <input 
                    type="text" 
                    value={localSettings.jianYingPath}
                    onChange={e => setLocalSettings({...localSettings, jianYingPath: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm bg-gray-50"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">图片导出路径</label>
                <input 
                    type="text" 
                    value={localSettings.outputImgPath}
                    onChange={e => setLocalSettings({...localSettings, outputImgPath: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm bg-gray-50"
                />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button onClick={handleSave}>
                <Save size={16} className="mr-2" />
                保存配置
            </Button>
        </div>
      </div>
    </div>
  );
};