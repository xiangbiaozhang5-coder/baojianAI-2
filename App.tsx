
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DraftsList } from './components/DraftsList';
import { CharacterLibrary } from './components/CharacterLibrary';
import { StoryboardEditor } from './components/StoryboardEditor';
import { SettingsModal } from './components/SettingsModal';
import { ToastContainer } from './components/Toast';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { ViewState, Project, Character, Settings, ToastMessage, GenerationModel } from './types';
import { storage } from './utils/storage';
import { parseSRT } from './utils/srtParser';
import { formatScriptText } from './utils/scriptParser';
import { Lock, User } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('drafts');
  const [projects, setProjects] = useState<Project[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [settings, setSettings] = useState<Settings>(storage.getSettings());
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = () => {
      const token = storage.getAuthToken();
      if (token) {
          setIsAuthenticated(true);
      } else {
          setIsAuthenticated(false);
          setShowAuthModal(true); // Force login on load if not authenticated
      }
  };

  const loadData = async () => {
    // Only load data if we have potential auth or local fallback
    const p = await storage.loadProjects();
    setProjects(p);
    const c = await storage.loadCharacters();
    setCharacters(c);
    const s = await storage.loadSettings();
    setSettings(s);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };
  
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLoginSuccess = () => {
      setIsAuthenticated(true);
      setShowAuthModal(false);
      showToast('登录成功', 'success');
      // Reload data in case it was isolated by user
      loadData();
  };

  const handleFloatingBtnClick = () => {
      if (!isAuthenticated) {
          setShowAuthModal(true);
      } else {
          const user = storage.getAuthUser();
          if (user?.type === 'admin') {
              setIsAdminOpen(true);
          } else {
              if (confirm('是否退出登录？')) {
                  storage.clearAuth();
                  setIsAuthenticated(false);
                  setShowAuthModal(true);
                  setProjects([]);
                  setCharacters([]);
              }
          }
      }
  };

  const handleCreateProject = async (name: string, srtFile: File | null) => {
    let initialFrames: any[] = [];
    if (srtFile) {
        try {
            const srtContent = await srtFile.text();
            const srtItems = parseSRT(srtContent);
            initialFrames = srtItems.map(item => ({
                id: `frame_${Math.random().toString(36).substr(2, 9)}`,
                scriptContent: formatScriptText(item.text),
                startTime: item.startTime,
                endTime: item.endTime,
                characterIds: [],
                aspectRatio: '4:3',
                model: settings.imageModel || GenerationModel.GEMINI_2_5_FLASH_IMAGE
            }));
            showToast(`已从 SRT 创建 ${initialFrames.length} 个分镜`, 'success');
        } catch (e) {
            console.error("Failed to parse SRT", e);
            showToast('SRT 解析失败', 'error');
        }
    }
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name: name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: '草稿',
      frames: initialFrames,
      localCharacters: [],
      promptPrefix: '参考图片风格，保持图中角色一致性'
    };
    const updated = [newProject, ...projects];
    setProjects(updated);
    storage.saveSingleProject(newProject);
    
    setActiveProjectId(newProject.id);
    setCurrentView('editor');
    if (!srtFile) showToast('新草稿已创建', 'success');
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('确认删除此草稿？')) {
      const updated = projects.filter(p => p.id !== id);
      setProjects(updated);
      storage.deleteProject(id);
      showToast('草稿已删除', 'info');
    }
  };

  const handleEditProject = (project: Project) => {
    setActiveProjectId(project.id);
    setCurrentView('editor');
  };

  const handleSaveProject = (updatedProject: Project) => {
    const updated = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
    setProjects(updated);
    storage.saveSingleProject(updatedProject);
  };

  const handleUpdateCharacters = (chars: Character[]) => {
    setCharacters(chars);
    storage.saveCharacters(chars);
  };
  
  const handleAddCharacter = (char: Character) => {
    const updated = [...characters, char];
    handleUpdateCharacters(updated);
    showToast('全局角色已添加', 'success');
  };

  const handleDeleteCharacter = (id: string) => {
    if (confirm('删除此全局角色？')) {
      handleUpdateCharacters(characters.filter(c => c.id !== id));
      showToast('全局角色已删除', 'info');
    }
  };
  
  const handleViewChange = (view: ViewState) => {
      if (view === 'settings') {
          setIsSettingsOpen(true);
      } else {
          setCurrentView(view);
      }
  };

  const renderContent = () => {
    if (currentView === 'editor' && activeProjectId) {
      const activeProject = projects.find(p => p.id === activeProjectId);
      if (activeProject) {
        return (
          <StoryboardEditor 
            project={activeProject}
            characters={characters}
            settings={settings}
            onSave={handleSaveProject}
            onBack={() => setCurrentView('drafts')}
            onUpdateCharacters={handleUpdateCharacters}
            showToast={showToast}
          />
        );
      }
    }

    return (
      <div className="flex h-screen bg-[#f8fafc]">
        <div className="relative z-20">
            <Sidebar currentView={currentView} onChangeView={handleViewChange} />
        </div>
        
        <main className="flex-1 ml-72 overflow-y-auto custom-scrollbar p-6">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {currentView === 'drafts' && (
                <DraftsList 
                projects={projects} 
                onDelete={handleDeleteProject}
                onEdit={handleEditProject}
                onCreate={handleCreateProject}
                />
            )}
            {currentView === 'characters' && (
                <CharacterLibrary 
                characters={characters}
                onAddCharacter={handleAddCharacter}
                onUpdateCharacter={(updated) => handleUpdateCharacters(characters.map(c => c.id === updated.id ? updated : c))}
                onDeleteCharacter={handleDeleteCharacter}
                />
            )}
          </div>
        </main>
      </div>
    );
  };

  return (
    <div style={({ '--brand-color': settings.themeColor } as React.CSSProperties)}>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        {/* Auth Lock Overlay - Only if not authenticated and modal closed (rare edge case) or blurred bg behind modal */}
        {!isAuthenticated && !showAuthModal && (
            <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center backdrop-blur-sm">
                <div className="text-white font-bold cursor-pointer" onClick={() => setShowAuthModal(true)}>
                    <Lock size={48} className="mx-auto mb-2"/>
                    点击解锁
                </div>
            </div>
        )}

        {/* Auth Modal */}
        {showAuthModal && (
            <AuthModal onAuthenticated={handleLoginSuccess} />
        )}

        <div className={`${!isAuthenticated ? 'filter blur-sm pointer-events-none' : ''}`}>
            {renderContent()}
        </div>

        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)}
            onSave={(newSettings) => {
                storage.saveSettings(newSettings);
                setSettings(newSettings);
                showToast('设置已保存', 'success');
            }}
            showToast={showToast}
        />
        
        {isAdminOpen && <AdminPanel onClose={() => setIsAdminOpen(false)} />}

        {/* Floating User Button */}
        <div className="fixed bottom-6 right-6 z-50">
            <button 
                onClick={handleFloatingBtnClick}
                className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 ${
                    isAuthenticated ? 'bg-white text-gray-800 hover:bg-gray-100' : 'bg-[var(--brand-color)] text-white animate-pulse'
                }`}
                title={isAuthenticated ? '用户中心/退出' : '点击登录'}
            >
                {isAuthenticated ? <User size={24}/> : <Lock size={24}/>}
            </button>
        </div>
    </div>
  );
};

export default App;
