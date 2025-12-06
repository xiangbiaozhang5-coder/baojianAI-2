
import { Project, Character, Settings, GenerationModel } from '../types';

const KEYS = {
  PROJECTS: 'baojian_projects',
  CHARACTERS: 'baojian_characters',
  SETTINGS: 'baojian_settings'
};

const DEFAULT_SETTINGS: Settings = {
  apiKeys: [], 
  // Set default Base URL to your private New API proxy
  baseUrl: 'https://bj.nfai.lol', 
  textModel: 'gemini-2.5-flash', 
  imageModel: GenerationModel.GEMINI_2_5_FLASH_IMAGE,
  jianYingPath: 'C:/Users/Admin/AppData/Local/JianYingPro/User Data/Projects/',
  outputImgPath: 'D:/AI_Output/',
  themeColor: '#f97316' // Default Orange
};

// API Helper
const api = {
    get: async (url: string) => {
        try {
            const res = await fetch(url);
            
            // Check content type to ensure we got JSON, not Vercel's HTML fallback
            const contentType = res.headers.get("content-type");
            if (!res.ok || !contentType || !contentType.includes("application/json")) {
                // Silently fail if not JSON (Offline/Static Mode)
                return null;
            }
            return await res.json();
        } catch (e) {
            // Silently fail on network errors to allow fallback
            return null;
        }
    },
    post: async (url: string, data: any) => {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            // If response is HTML (Vercel), ignore it.
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) return;
        } catch (e) {
            // Ignore errors in static mode
        }
    },
    delete: async (url: string) => {
        try {
            await fetch(url, { method: 'DELETE' });
        } catch (e) {
             // Ignore errors
        }
    }
};

export const storage = {
  // --- Projects ---
  
  loadProjects: async (): Promise<Project[]> => {
      // Try Server first
      const serverData = await api.get('/api/projects');
      if (serverData) {
          // Update Cache
          localStorage.setItem(KEYS.PROJECTS, JSON.stringify(serverData));
          return serverData;
      }
      // Fallback to LocalStorage (Vercel Mode)
      const local = localStorage.getItem(KEYS.PROJECTS);
      return local ? JSON.parse(local) : [];
  },

  getProjectsSync: (): Project[] => {
    const data = localStorage.getItem(KEYS.PROJECTS);
    return data ? JSON.parse(data) : [];
  },

  saveProjects: async (projects: Project[]) => {
    // 1. Save Local (Always works)
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
    
    // 2. Try Save to Server (Will fail silently on Vercel)
    for (const p of projects) {
        await api.post('/api/projects', p);
    }
  },

  saveSingleProject: async (project: Project) => {
      const projects = storage.getProjectsSync();
      const idx = projects.findIndex(p => p.id === project.id);
      const updated = idx >= 0 
        ? projects.map(p => p.id === project.id ? project : p)
        : [project, ...projects];
      
      localStorage.setItem(KEYS.PROJECTS, JSON.stringify(updated));

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
      return storage.getSettingsSync();
  },

  getSettingsSync: (): Settings => {
    const data = localStorage.getItem(KEYS.SETTINGS);
    const localSettings = data ? JSON.parse(data) : DEFAULT_SETTINGS;
    // Ensure baseUrl defaults to the correct proxy if missing or empty in local storage
    if (!localSettings.baseUrl) {
        localSettings.baseUrl = DEFAULT_SETTINGS.baseUrl;
    }
    return { ...DEFAULT_SETTINGS, ...localSettings };
  },

  getSettings: (): Settings => {
    return storage.getSettingsSync();
  },

  saveSettings: async (settings: Settings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    await api.post('/api/settings', settings);
  },
  
  // Public Accessors for components that need sync access (Legacy support)
  getProjects: () => storage.getProjectsSync(),
  getCharacters: () => storage.getCharactersSync(),
};

export const getSettings = storage.getSettingsSync;
