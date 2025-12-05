import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DraftsList } from './components/DraftsList';
import { CharacterLibrary } from './components/CharacterLibrary';
import { StoryboardEditor } from './components/StoryboardEditor';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { ToastContainer } from './components/Toast';
import { ViewState, Project, Character, Settings, ToastMessage, GenerationModel } from './types';
import { storage } from './utils/storage';
import { parseSRT } from './utils/srtParser';
import { formatScriptText } from './utils/scriptParser';

const App: React.FC = () => {
  // Application State
  const [currentView, setCurrentView] = useState<ViewState>('drafts');
  const [projects, setProjects] = useState<Project[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [settings, setSettings] = useState<Settings>(storage.getSettings());
  
  // Auth State: If apiKeys is empty, user is not authenticated/configured
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Initialize from storage
  useEffect(() => {
    setProjects(storage.getProjects());
    setCharacters(storage.getCharacters());
    const currentSettings = storage.getSettings();
    setSettings(currentSettings);
    
    // Check if we have valid keys
    if (currentSettings.apiKeys && currentSettings.apiKeys.length > 0) {
        setIsAuthenticated(true);
    } else {
        setIsAuthenticated(false);
    }
  }, []);

  // Toast Handler
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };
  
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Handlers
  const handleAuthenticated = () => {
      // Refresh settings to get the key saved by AuthModal
      const newSettings = storage.getSettings();
      setSettings(newSettings);
      setIsAuthenticated(true);
      showToast("验证通过，欢迎使用", "success");
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
            console.error("Failed to parse SRT on create", e);
            showToast('SRT 解析失败，将创建空草稿', 'error');
        }
    }

    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name: name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: '草稿',
      frames: initialFrames,
      localCharacters: [], // Init empty
      promptPrefix: '参考图片风格，保持图中角色一致性' // Default prefix
    };
    const updated = [newProject, ...projects];
    setProjects(updated);
    storage.saveProjects(updated);
    
    setActiveProjectId(newProject.id);
    setCurrentView('editor');
    if (!srtFile) showToast('新草稿已创建', 'success');
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('确认删除此草稿？')) {
      const updated = projects.filter(p => p.id !== id);
      setProjects(updated);
      storage.saveProjects(updated);
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
    storage.saveProjects(updated);
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

  // Render logic based on view state
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

    // Default layouts with sidebar
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar currentView={currentView} onChangeView={handleViewChange} />
        <main className="flex-1 ml-64 overflow-y-auto">
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
              onUpdateCharacter={(updated) => {
                  handleUpdateCharacters(characters.map(c => c.id === updated.id ? updated : c));
                  showToast('角色已更新', 'success');
              }}
              onDeleteCharacter={handleDeleteCharacter}
            />
          )}
        </main>
      </div>
    );
  };

  return (
    <div style={({ '--brand-color': settings.themeColor } as React.CSSProperties)}>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        {/* Gatekeeper Modal */}
        {!isAuthenticated && <AuthModal onAuthenticated={handleAuthenticated} />}

        {/* Main App (Blurred if not authenticated) */}
        <div className={!isAuthenticated ? 'filter blur-sm pointer-events-none h-screen overflow-hidden' : ''}>
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
    </div>
  );
};

export default App;