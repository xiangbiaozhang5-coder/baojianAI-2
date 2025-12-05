import React, { useState } from 'react';
import { Button } from './Button';
import { Key, Activity, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { testApiConnection } from '../services/geminiService';
import { Settings } from '../types';
import { storage } from '../utils/storage';

interface AuthModalProps {
  onAuthenticated: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated }) => {
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleTestAndEnter = async () => {
    if (!apiKey.trim()) {
        setErrorMsg('请输入 API Key');
        return;
    }
    
    setIsTesting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
        await testApiConnection(apiKey);
        setSuccessMsg('连接成功！正在进入系统...');
        
        // Save to storage
        const currentSettings = storage.getSettings();
        const newSettings: Settings = {
            ...currentSettings,
            apiKeys: [apiKey.trim()]
        };
        storage.saveSettings(newSettings);
        
        // Slight delay for UX
        setTimeout(() => {
            onAuthenticated();
        }, 1000);

    } catch (e: any) {
        setErrorMsg(e.message || '连接失败，请检查 Key 是否正确');
    } finally {
        setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-[var(--brand-color)] p-6 text-center">
                <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                    <ShieldCheck size={32} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">欢迎使用 豹剪AI</h2>
                <p className="text-white/80 text-sm mt-1">请验证身份以继续</p>
            </div>

            <div className="p-8 space-y-6">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Gemini 官方 API Key</label>
                    <div className="relative">
                        <Key className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input 
                            type="password" 
                            value={apiKey}
                            onChange={(e) => {
                                setApiKey(e.target.value);
                                setErrorMsg('');
                            }}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-color)] focus:border-transparent outline-none transition-all"
                            placeholder="sk-..."
                        />
                    </div>
                    <p className="text-xs text-gray-500">
                        我们需要验证您的官方 API Key 才能连接服务。
                    </p>
                </div>

                {errorMsg && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
                        <AlertCircle size={16} className="shrink-0" />
                        {errorMsg}
                    </div>
                )}

                {successMsg && (
                    <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
                        <CheckCircle size={16} className="shrink-0" />
                        {successMsg}
                    </div>
                )}

                <Button 
                    onClick={handleTestAndEnter} 
                    disabled={isTesting || !apiKey} 
                    className="w-full py-4 text-lg shadow-xl shadow-[var(--brand-color)]/20"
                >
                    {isTesting ? (
                        <>
                            <Activity className="animate-spin mr-2" />
                            正在验证...
                        </>
                    ) : (
                        '确定并进入'
                    )}
                </Button>
            </div>
            
            <div className="bg-gray-50 p-4 text-center text-xs text-gray-400 border-t border-gray-100">
                本软件仅连接 Google Gemini 官方接口，不经由第三方代理。
            </div>
        </div>
    </div>
  );
};