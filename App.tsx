import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DraftsList } from './components/DraftsList';
import { CharacterLibrary } from './components/CharacterLibrary';
import { StoryboardEditor } from './components/StoryboardEditor';
import { SettingsModal } from './components/SettingsModal';
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

  // Initialize from storage
  useEffect(() => {
    setProjects(storage.getProjects());
    setCharacters(storage.getCharacters());
    setSettings(storage.getSettings());
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
                model: settings.imageModel || GenerationModel.NANOBANANA
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
    // Note: The click handling is now safe due to stopPropagation in DraftsList
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
    // Note: The click handling is now safe due to stopPropagation in CharacterLibrary
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
        {renderContent()}
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)}
            onSave={(newSettings) => {
                storage.saveSettings(newSettings);
                setSettings(newSettings);
                showToast('设置已保存', 'success');
            }}
        />
    </div>
  );
};

export default App;