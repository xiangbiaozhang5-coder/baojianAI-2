
import React, { useState, useEffect } from 'react';
import { Settings, GenerationModel, TEXT_MODELS } from '../types';
import { Button } from './Button';
import { X, Save, Palette, Key, Plus, Trash2, Check, AlertTriangle, Loader2, Globe, Edit, List, FileText } from 'lucide-react';
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
  
  // Batch Mode State
  const [isBatchEdit, setIsBatchEdit] = useState(false);
  const [batchText, setBatchText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(storage.getSettings());
      setNewKey('');
      setKeyStatuses({});
      setIsBatchEdit(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    // If saving while in batch mode, save the batch text first
    let finalKeys = localSettings.apiKeys;
    if (isBatchEdit) {
        finalKeys = parseBatchKeys(batchText);
    }

    if (finalKeys.length === 0) {
        showToast("警告：未配置 API Key，功能可能无法使用", "info");
    }

    // Deep trim all keys and url before saving
    const cleanedSettings = {
        ...localSettings,
        apiKeys: finalKeys,
        baseUrl: localSettings.baseUrl?.trim().replace(/\/+$/, '') || ''
    };

    storage.saveSettings(cleanedSettings);
    onSave(cleanedSettings);
    onClose();
  };

  const cleanInputKey = (key: string): string => {
      // Basic cleaning for input
      return key.trim().replace(/^['"]+|['"]+$/g, '').replace(/[\s\uFEFF\xA0]+/g, '');
  };

  const handleAddKey = async () => {
      const cleanedKey = cleanInputKey(newKey);
      if (!cleanedKey) return;
      
      if (localSettings.apiKeys.includes(cleanedKey)) {
          showToast("该 Key 已存在", "error");
          return;
      }

      // Basic structure check warning (but don't block)
      if (!cleanedKey.startsWith('AIza') && !cleanedKey.startsWith('sk-')) {
          showToast("提示: Key 格式似乎不标准 (通常以 AIza 或 sk- 开头)", "info");
      }

      setLocalSettings(prev => ({
          ...prev,
          apiKeys: [...prev.apiKeys, cleanedKey]
      }));
      setNewKey('');
  };

  const handleRemoveKey = (index: number) => {
      setLocalSettings(prev => ({
          ...prev,
          apiKeys: prev.apiKeys.filter((_, i) => i !== index)
      }));
      const newStatuses = {...keyStatuses};
      delete newStatuses[index];
      setKeyStatuses(newStatuses);
  };
  
  const handleClearAllKeys = () => {
      if (confirm(`确定要删除全部 ${localSettings.apiKeys.length} 个 API Key 吗？`)) {
          setLocalSettings(prev => ({ ...prev, apiKeys: [] }));
          setKeyStatuses({});
          showToast("已清空所有 API Key", "info");
      }
  };

  const handleTestKey = async (key: string, index: number) => {
    setTestingIndex(index);
    // Sanitize before testing
    const cleanUrl = localSettings.baseUrl?.trim().replace(/\/+$/, '');
    const cleanKey = cleanInputKey(key);

    try {
        await testApiConnection(cleanKey, cleanUrl || '');
        setKeyStatuses(prev => ({ ...prev, [index]: 'valid' }));
        showToast("连接成功", "success");
    } catch (e: any) {
        setKeyStatuses(prev => ({ ...prev, [index]: 'invalid' }));
        showToast(`测试失败: ${e.message}`, "error");
    } finally {
        setTestingIndex(null);
    }
  };
  
  // Batch Logic
  const parseBatchKeys = (text: string): string[] => {
      const keys = text.split('\n')
          .map(k => cleanInputKey(k))
          .filter(k => k.length > 0);
      return Array.from(new Set(keys)); // Deduplicate
  };

  const toggleBatchMode = () => {
      if (!isBatchEdit) {
          // Enter batch mode
          setBatchText(localSettings.apiKeys.join('\n'));
      } else {
          // Exit batch mode (Save)
          const newKeys = parseBatchKeys(batchText);
          setLocalSettings(prev => ({ ...prev, apiKeys: newKeys }));
          setKeyStatuses({}); // Reset statuses as indices change
      }
      setIsBatchEdit(!isBatchEdit);
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
          
          {/* API Configuration Section */}
          <div className="space-y-4 border-b border-gray-100 pb-6">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <Key size={18} className="text-[var(--brand-color)]" /> API 连接配置
            </h4>

            {/* Base URL Input */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Globe size={14} />
                    API 代理地址 (Proxy URL)
                </label>
                <input 
                    type="text" 
                    value={localSettings.baseUrl}
                    onChange={e => setLocalSettings({...localSettings, baseUrl: e.target.value})}
                    onBlur={() => setLocalSettings(prev => ({...prev, baseUrl: prev.baseUrl.trim()}))}
                    placeholder="留空则使用官方地址 (https://generativelanguage.googleapis.com)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-color)] outline-none text-sm font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                    默认为空 (或官方地址)。若使用第三方代理，请填写完整地址 (例如: https://proxy.example.com)。
                </p>
            </div>
            
            <div className="space-y-3">
                 <div className="flex justify-between items-end">
                     <label className="block text-sm font-medium text-gray-700">API Key 管理 (可添加多个以自动轮询)</label>
                     <div className="flex gap-3">
                        {!isBatchEdit && localSettings.apiKeys.length > 0 && (
                            <button 
                                onClick={handleClearAllKeys} 
                                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 hover:underline"
                            >
                                <Trash2 size={12} /> 清空全部
                            </button>
                        )}
                        <button 
                            onClick={toggleBatchMode} 
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium bg-blue-50 px-2 py-1 rounded border border-blue-100"
                        >
                            {isBatchEdit ? <List size={12}/> : <FileText size={12}/>}
                            {isBatchEdit ? "返回列表模式" : "批量文本管理"}
                        </button>
                     </div>
                 </div>
                
                {isBatchEdit ? (
                    <div className="animate-in fade-in zoom-in-95">
                        <textarea 
                            className="w-full h-64 p-3 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[var(--brand-color)] outline-none resize-none bg-gray-50"
                            placeholder={`sk-abc123...\nsk-def456...\nsk-ghi789...`}
                            value={batchText}
                            onChange={e => setBatchText(e.target.value)}
                        />
                        <p className="text-[10px] text-gray-500 mt-1 flex justify-between">
                            <span>请粘贴您的 API Key，一行一个。保存时会自动去重。</span>
                            <span className="font-bold text-[var(--brand-color)]">当前行数: {batchText.split('\n').filter(l=>l.trim()).length}</span>
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {localSettings.apiKeys.length === 0 && (
                                <div className="text-center py-8 text-gray-400 text-xs border-2 border-dashed border-gray-200 rounded-lg">
                                    暂无 API Key，请添加
                                </div>
                            )}
                            {localSettings.apiKeys.map((key, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                                    <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                                        {index + 1}
                                    </div>
                                    <input 
                                        type="password" 
                                        value={key}
                                        readOnly 
                                        className="flex-1 bg-transparent border-none text-gray-600 text-xs focus:ring-0 font-mono" 
                                    />
                                    
                                    {keyStatuses[index] === 'valid' && <Check size={14} className="text-green-500" />}
                                    {keyStatuses[index] === 'invalid' && <AlertTriangle size={14} className="text-red-500" />}

                                    <button 
                                        onClick={() => handleTestKey(key, index)}
                                        disabled={testingIndex === index}
                                        className="text-[10px] px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-600 flex items-center gap-1 whitespace-nowrap"
                                    >
                                        {testingIndex === index ? <Loader2 size={10} className="animate-spin"/> : "测试"}
                                    </button>

                                    <button 
                                        onClick={() => handleRemoveKey(index)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                        title="删除"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-gray-50 mt-2">
                            <input 
                                type="password"
                                value={newKey}
                                onChange={e => setNewKey(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddKey()}
                                placeholder="输入 API Key (自动去引号/空格)"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-color)] outline-none text-sm font-mono"
                            />
                            <Button onClick={handleAddKey} disabled={!newKey.trim()} variant="secondary" className="whitespace-nowrap">
                                <Plus size={16} className="mr-1" /> 添加
                            </Button>
                        </div>
                    </>
                )}
            </div>
          </div>

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

          {/* Models */}
          <div className="space-y-4 border-b border-gray-100 pb-6">
            <h4 className="font-semibold text-gray-900">模型选择</h4>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">推理/文本模型</label>
                    <select 
                        value={localSettings.textModel}
                        onChange={e => setLocalSettings({...localSettings, textModel: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                        {TEXT_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">生图模型</label>
                    <select 
                        value={localSettings.imageModel}
                        onChange={e => setLocalSettings({...localSettings, imageModel: e.target.value as GenerationModel})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
