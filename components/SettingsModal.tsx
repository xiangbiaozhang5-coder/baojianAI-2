import React, { useState, useEffect } from 'react';
import { Settings, GenerationModel, TEXT_MODELS } from '../types';
import { Button } from './Button';
import { X, Save, Palette, Key, Plus, Trash2, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { storage } from '../utils/storage';
import { testApiConnection } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const THEME_COLORS = [
  { name: '活力橙', value: '#f97316' },
  { name: '科技蓝', value: '#3b82f6' },
  { name: '赛博紫', value: '#8b5cf6' },
  { name: '极光绿', value: '#10b981' },
  { name: '未来青', value: '#06b6d4' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, showToast }) => {
  const [localSettings, setLocalSettings] = useState<Settings>(storage.getSettings());
  const [newKey, setNewKey] = useState('');
  const [testingIndex, setTestingIndex] = useState<number | null>(null);
  const [keyStatuses, setKeyStatuses] = useState<Record<number, 'valid' | 'invalid' | null>>({});

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(storage.getSettings());
      setNewKey('');
      setKeyStatuses({});
    }
  }, [isOpen]);

  const handleSave = () => {
    // Basic validation
    if (localSettings.apiKeys.length === 0) {
        showToast("至少需要一个有效的 API Key", "error");
        return;
    }
    storage.saveSettings(localSettings);
    onSave(localSettings);
    onClose();
  };

  const handleAddKey = async () => {
      if (!newKey.trim()) return;
      // Optional: Auto-test before adding? Or just add.
      // Let's just add it, user can test in list.
      if (localSettings.apiKeys.includes(newKey.trim())) {
          showToast("该 Key 已存在", "error");
          return;
      }
      setLocalSettings(prev => ({
          ...prev,
          apiKeys: [...prev.apiKeys, newKey.trim()]
      }));
      setNewKey('');
  };

  const handleRemoveKey = (index: number) => {
      setLocalSettings(prev => ({
          ...prev,
          apiKeys: prev.apiKeys.filter((_, i) => i !== index)
      }));
      // Clean up status
      const newStatuses = {...keyStatuses};
      delete newStatuses[index];
      setKeyStatuses(newStatuses);
  };

  const handleTestKey = async (key: string, index: number) => {
    setTestingIndex(index);
    try {
        await testApiConnection(key);
        setKeyStatuses(prev => ({ ...prev, [index]: 'valid' }));
        showToast("连接成功", "success");
    } catch (e: any) {
        setKeyStatuses(prev => ({ ...prev, [index]: 'invalid' }));
        showToast(`测试失败: ${e.message}`, "error");
    } finally {
        setTestingIndex(null);
    }
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
          
          {/* Theme */}
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
                    />
                ))}
            </div>
          </div>

          {/* API Keys Configuration */}
          <div className="space-y-4 border-b border-gray-100 pb-6">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Key size={18} className="text-[var(--brand-color)]" /> API Key 管理 (官方)
                </h4>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    支持多 Key 自动轮询 (当额度耗尽时自动切换)
                </span>
            </div>
            
            <div className="space-y-3">
                {localSettings.apiKeys.map((key, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                            {index + 1}
                        </div>
                        <input 
                            type="password" 
                            value={key}
                            readOnly 
                            className="flex-1 bg-transparent border-none text-gray-600 text-sm focus:ring-0" 
                        />
                        
                        {keyStatuses[index] === 'valid' && <Check size={16} className="text-green-500" />}
                        {keyStatuses[index] === 'invalid' && <AlertTriangle size={16} className="text-red-500" />}

                        <button 
                            onClick={() => handleTestKey(key, index)}
                            disabled={testingIndex === index}
                            className="text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-600 flex items-center gap-1"
                        >
                            {testingIndex === index ? <Loader2 size={12} className="animate-spin"/> : "测试"}
                        </button>

                        <button 
                            onClick={() => handleRemoveKey(index)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}

                <div className="flex gap-2 pt-2">
                    <input 
                        type="password"
                        value={newKey}
                        onChange={e => setNewKey(e.target.value)}
                        placeholder="输入新的 Gemini API Key (sk-...)"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-color)] outline-none text-sm"
                    />
                    <Button onClick={handleAddKey} disabled={!newKey.trim()} variant="secondary">
                        <Plus size={16} className="mr-1" /> 添加
                    </Button>
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
                        <option value={GenerationModel.GEMINI_2_5_FLASH_IMAGE}>NanoBanana</option>
                        <option value={GenerationModel.GEMINI_3_PRO_IMAGE_PREVIEW}>NanoBanana Pro</option>
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