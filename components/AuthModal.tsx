
import React, { useState } from 'react';
import { Activity, CheckCircle, AlertCircle, ShieldCheck, Key, ArrowRight, Lock, Zap } from 'lucide-react';
import { storage } from '../utils/storage';

interface AuthModalProps {
  onAuthenticated: () => void;
  onClose?: () => void; // Optional if triggered manually
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated, onClose }) => {
  const [keyCode, setKeyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = async () => {
    if (!keyCode.trim()) {
        setErrorMsg('请输入卡密');
        return;
    }
    
    setIsVerifying(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Setup Timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        let hwId = localStorage.getItem('hw_id');
        if (!hwId) {
            hwId = Math.random().toString(36).substring(2) + Date.now().toString(36);
            localStorage.setItem('hw_id', hwId);
        }

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyCode: keyCode.trim(), hardwareId: hwId }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await res.json();

        if (res.ok) {
            storage.setAuth(data.token, data.user);
            setSuccessMsg('验证通过');
            
            // Fast feedback, close almost immediately
            setTimeout(() => {
                onAuthenticated();
            }, 300);
        } else {
            setErrorMsg(data.error || '验证失败');
            setIsVerifying(false);
        }

    } catch (e: any) {
        if (e.name === 'AbortError') {
            setErrorMsg('连接超时，请检查网络');
        } else {
            setErrorMsg('无法连接服务器 (是否已启动后端?)');
        }
        setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-300">
        
        {/* Background Effects */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[var(--brand-color)] to-purple-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl w-full max-w-sm shadow-2xl border border-white/50 relative z-10 overflow-hidden flex flex-col">
            
            {onClose && (
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
                    <AlertCircle size={20}/>
                </button>
            )}

            {/* Header */}
            <div className="pt-8 pb-4 flex flex-col items-center">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center shadow-lg mb-4 text-white">
                    <ShieldCheck size={32} />
                </div>
                <h2 className="text-2xl font-black text-gray-800 tracking-tight">身份验证</h2>
                <p className="text-gray-500 text-xs font-medium mt-1">请输入授权卡密以继续使用</p>
            </div>

            {/* Form */}
            <div className="px-6 pb-6 space-y-4">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Key className="text-gray-400 group-focus-within:text-[var(--brand-color)] transition-colors" size={16} />
                    </div>
                    <input 
                        type="text" 
                        value={keyCode}
                        onChange={(e) => {
                            setKeyCode(e.target.value);
                            setErrorMsg('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--brand-color)] focus:border-transparent outline-none transition-all font-mono text-gray-800 text-sm font-bold placeholder-gray-400"
                        placeholder="BJ-XXXX-XXXX-XXXX"
                    />
                </div>

                {errorMsg && (
                    <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs flex items-center gap-2 animate-in slide-in-from-top-1 border border-red-100">
                        <AlertCircle size={14} className="shrink-0" />
                        <span className="font-medium">{errorMsg}</span>
                    </div>
                )}

                {successMsg && (
                    <div className="bg-green-50 text-green-600 px-3 py-2 rounded-lg text-xs flex items-center gap-2 animate-in slide-in-from-top-1 border border-green-100">
                        <CheckCircle size={14} className="shrink-0" />
                        <span className="font-medium">{successMsg}</span>
                    </div>
                )}

                <button 
                    onClick={handleLogin} 
                    disabled={isVerifying || !keyCode}
                    className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl shadow-lg shadow-gray-900/20 hover:bg-black hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                >
                    {isVerifying ? (
                        <>
                            <Activity className="animate-spin" size={18} />
                            <span>验证中...</span>
                        </>
                    ) : (
                        <>
                            <span>立即激活</span>
                            <ArrowRight size={18} />
                        </>
                    )}
                </button>
            </div>

            <div className="bg-gray-50 p-3 text-center border-t border-gray-100">
                <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                    <Lock size={10} /> 安全加密连接 · 
                    <Zap size={10} className="text-yellow-500" /> 高速验证
                </div>
            </div>
        </div>
    </div>
  );
};
