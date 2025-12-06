
import React, { useState, useEffect } from 'react';
import { Settings, GenerationModel, TEXT_MODELS } from '../types';
import { Button } from './Button';
import { X, Save, Palette, Key, Globe, Loader2, Check, AlertTriangle, ExternalLink, CreditCard } from 'lucide-react';
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
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'valid' | 'invalid' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(storage.getSettings());
      setTestStatus(null);
    }
  }, [isOpen]);

  const handleSave = () => {
    let finalBaseUrl = localSettings.baseUrl?.trim().replace(/\/+$/, '');
    if (!finalBaseUrl) finalBaseUrl = 'https://api.xxapi.xyz';
    
    const cleanedSettings = {
        ...localSettings,
        baseUrl: finalBaseUrl,
        apiKey: localSettings.apiKey.trim()
    };

    storage.saveSettings(cleanedSettings);
    onSave(cleanedSettings);
    onClose();
  };

  const handleTestKey = async () => {
    setIsTesting(true);
    setTestStatus(null);
    const cleanUrl = localSettings.baseUrl?.trim().replace(/\/+$/, '') || 'https://api.xxapi.xyz';
    const cleanKey = localSettings.apiKey.trim();
    const modelToTest = localSettings.textModel || 'gemini-2.5-pro';

    if (!cleanKey) {
        setIsTesting(false);
        showToast('请输入 API Key', 'error');
        return;
    }

    try {
        await testApiConnection(cleanKey, cleanUrl, modelToTest);
        setTestStatus('valid');
        showToast(`连接成功 (${modelToTest})`, "success");
    } catch (e: any) {
        setTestStatus('invalid');
        showToast(`测试失败: ${e.message}`, "error");
    } finally {
        setIsTesting(false);
    }
  };

  const handleRecharge = () => {
    window.open('https://api.xxapi.xyz', '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-xl text-gray-800">系统设置</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* API Config */}
          <div className="space-y-6 border-b border-gray-100 pb-6">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Key size={18} className="text-[var(--brand-color)]" /> API 配置
                </h4>
                <Button size="sm" onClick={handleRecharge} className="bg-green-600 hover:bg-green-700 text-white border-none shadow-green-500/20">
                    <CreditCard size={14} className="mr-1"/> 充值余额
                </Button>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Globe size={14} /> 接口地址 (Base URL)
                </label>
                <input 
                    type="text" 
                    value={localSettings.baseUrl}
                    onChange={e => setLocalSettings({...localSettings, baseUrl: e.target.value})}
                    onBlur={() => {
                        let url = localSettings.baseUrl.trim();
                        if (!url) url = 'https://api.xxapi.xyz';
                        setLocalSettings(prev => ({...prev, baseUrl: url}));
                    }}
                    placeholder="https://api.xxapi.xyz"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-color)] outline-none text-sm font-mono"
                />
            </div>
            
            <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">API Key (密钥)</label>
                 <div className="flex gap-2">
                     <input 
                        type="password"
                        value={localSettings.apiKey}
                        onChange={e => {
                            setLocalSettings({...localSettings, apiKey: e.target.value});
                            setTestStatus(null);
                        }}
                        placeholder="sk-..."
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--brand-color)] outline-none text-sm font-mono ${
                            testStatus === 'valid' ? 'border-green-500 bg-green-50' : 
                            testStatus === 'invalid' ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                     />
                     <Button onClick={handleTestKey} disabled={!localSettings.apiKey.trim() || isTesting} variant="secondary">
                         {isTesting ? <Loader2 className="animate-spin" size={16}/> : (testStatus === 'valid' ? <Check size={16}/> : <AlertTriangle size={16}/>)}
                         {isTesting ? "测试中" : "测试"}
                     </Button>
                 </div>
                 <p className="text-[10px] text-gray-400 mt-1 flex justify-between">
                    <span>请输入您购买的 API Key</span>
                    <a href="https://api.xxapi.xyz" target="_blank" className="text-blue-500 hover:underline flex items-center gap-1">
                        去购买 <ExternalLink size={10}/>
                    </a>
                 </p>
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

          {/* Theme */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <Palette size={18} className="text-[var(--brand-color)]" /> 主题色
            </h4>
            <div className="flex gap-4">
                {THEME_COLORS.map(color => (
                    <button
                        key={color.value}
                        onClick={() => setLocalSettings({...localSettings, themeColor: color.value})}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${localSettings.themeColor === color.value ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color.value }}
                    />
                ))}
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
