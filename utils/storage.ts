import { Project, Character, Settings, GenerationModel } from '../types';

const KEYS = {
  PROJECTS: 'baojian_projects',
  CHARACTERS: 'baojian_characters',
  SETTINGS: 'baojian_settings'
};

const DEFAULT_SETTINGS: Settings = {
  apiKeys: [], 
  baseUrl: '', 
  textModel: 'gemini-2.5-flash', 
  imageModel: GenerationModel.GEMINI_2_5_FLASH_IMAGE,
  jianYingPath: '',
  outputImgPath: '',
  themeColor: '#f97316' 
};

// API Helper
const api = {
    get: async (url: string) => {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(res.statusText);
            return await res.json();
        } catch (e) {
            console.warn(`API Load Failed [${url}], falling back to local`, e);
            return null;
        }
    },
    post: async (url: string, data: any) => {
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.error(`API Save Failed [${url}]`, e);
        }
    },
    delete: async (url: string) => {
        try {
            await fetch(url, { method: 'DELETE' });
        } catch (e) {
             console.error(`API Delete Failed [${url}]`, e);
        }
    }
};

export const storage = {
  // --- Projects (Fully Async Recommended, but we keep hybrid for speed) ---
  
  loadProjects: async (): Promise<Project[]> => {
      // Try Server first
      const serverData = await api.get('/api/projects');
      if (serverData) {
          // Update Cache
          localStorage.setItem(KEYS.PROJECTS, JSON.stringify(serverData));
          return serverData;
      }
      // Fallback
      const local = localStorage.getItem(KEYS.PROJECTS);
      return local ? JSON.parse(local) : [];
  },

  // Synchronous getter for initial rendering (might be stale, but instant)
  getProjectsSync: (): Project[] => {
    const data = localStorage.getItem(KEYS.PROJECTS);
    return data ? JSON.parse(data) : [];
  },

  saveProjects: async (projects: Project[]) => {
    // 1. Save Local (Instant UI update)
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
    
    // 2. Save to Server
    for (const p of projects) {
        // In a real app we'd optimize this, but for now we sync everything
        await api.post('/api/projects', p);
    }
  },

  saveSingleProject: async (project: Project) => {
      // Update Local Array
      const projects = storage.getProjectsSync();
      const idx = projects.findIndex(p => p.id === project.id);
      const updated = idx >= 0 
        ? projects.map(p => p.id === project.id ? project : p)
        : [project, ...projects];
      
      localStorage.setItem(KEYS.PROJECTS, JSON.stringify(updated));

      // Update Server
      await api.post('/api/projects', project);
  },

  deleteProject: async (id: string) => {
      const projects = storage.getProjectsSync().filter(p => p.id !== id);
      localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
      await api.delete(`/api/projects/${id}`);
  },

  // --- Characters ---
  
  loadCharacters: async (): Promise<Character[]> => {
      const serverData = await api.get('/api/characters');
      if (serverData) {
          localStorage.setItem(KEYS.CHARACTERS, JSON.stringify(serverData));
          return serverData;
      }
      const local = localStorage.getItem(KEYS.CHARACTERS);
      return local ? JSON.parse(local) : [];
  },

  getCharactersSync: (): Character[] => {
      const data = localStorage.getItem(KEYS.CHARACTERS);
      return data ? JSON.parse(data) : [];
  },

  saveCharacters: async (chars: Character[]) => {
      localStorage.setItem(KEYS.CHARACTERS, JSON.stringify(chars));
      await api.post('/api/characters', chars);
  },

  // --- Settings ---

  loadSettings: async (): Promise<Settings> => {
      const serverData = await api.get('/api/settings');
      if (serverData && Object.keys(serverData).length > 0) {
           const merged = { ...DEFAULT_SETTINGS, ...serverData };
           localStorage.setItem(KEYS.SETTINGS, JSON.stringify(merged));
           return merged;
      }
      return storage.getSettingsSync(); // Fallback to local
  },

  getSettingsSync: (): Settings => {
    const data = localStorage.getItem(KEYS.SETTINGS);
    const localSettings = data ? JSON.parse(data) : DEFAULT_SETTINGS;
    
    // Merge with defaults
    return { ...DEFAULT_SETTINGS, ...localSettings };
  },

  // Added alias for components expecting getSettings
  getSettings: (): Settings => {
    const data = localStorage.getItem(KEYS.SETTINGS);
    const localSettings = data ? JSON.parse(data) : DEFAULT_SETTINGS;
    
    // Merge with defaults
    return { ...DEFAULT_SETTINGS, ...localSettings };
  },

  saveSettings: async (settings: Settings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    await api.post('/api/settings', settings);
  }
};

// Backwards compatibility alias for components calling getSettings() synchronously
export const getSettings = storage.getSettingsSync;