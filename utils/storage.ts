
import { Project, Character, Settings, GenerationModel } from '../types';

const KEYS = {
  PROJECTS: 'baojian_projects',
  CHARACTERS: 'baojian_characters',
  SETTINGS: 'baojian_settings',
  AUTH_TOKEN: 'baojian_auth_token',
  AUTH_USER: 'baojian_user'
};

const DEFAULT_SETTINGS: Settings = {
  apiKey: '', // Single Key
  baseUrl: 'https://api.xxapi.xyz', 
  textModel: 'gemini-2.5-pro', 
  imageModel: GenerationModel.GEMINI_2_5_FLASH_IMAGE,
  jianYingPath: 'C:/Users/Admin/AppData/Local/JianYingPro/User Data/Projects/',
  outputImgPath: 'D:/AI_Output/',
  themeColor: '#f97316'
};

const api = {
    get: async (url: string) => {
        try {
            const token = localStorage.getItem(KEYS.AUTH_TOKEN);
            const headers: any = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const res = await fetch(url, { headers });
            const contentType = res.headers.get("content-type");
            if (!res.ok || !contentType || !contentType.includes("application/json")) {
                if (res.status === 401 || res.status === 403) {
                   // Handle auth fail if needed
                }
                return null;
            }
            return await res.json();
        } catch (e) {
            return null;
        }
    },
    post: async (url: string, data: any) => {
        try {
            const token = localStorage.getItem(KEYS.AUTH_TOKEN);
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) return;
        } catch (e) {
            // Ignore
        }
    },
    delete: async (url: string) => {
        try {
            const token = localStorage.getItem(KEYS.AUTH_TOKEN);
            const headers: any = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            await fetch(url, { method: 'DELETE', headers });
        } catch (e) {
            // Ignore
        }
    }
};

export const storage = {
  // --- Projects ---
  loadProjects: async (): Promise<Project[]> => {
      // Try Server first if Authenticated
      if (storage.getAuthToken()) {
          const serverData = await api.get('/api/projects');
          if (serverData) {
              localStorage.setItem(KEYS.PROJECTS, JSON.stringify(serverData));
              return serverData;
          }
      }
      const local = localStorage.getItem(KEYS.PROJECTS);
      return local ? JSON.parse(local) : [];
  },

  getProjectsSync: (): Project[] => {
    const data = localStorage.getItem(KEYS.PROJECTS);
    return data ? JSON.parse(data) : [];
  },

  saveProjects: async (projects: Project[]) => {
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
    if (storage.getAuthToken()) {
        for (const p of projects) {
            await api.post('/api/projects', p);
        }
    }
  },

  saveSingleProject: async (project: Project) => {
      const projects = storage.getProjectsSync();
      const idx = projects.findIndex(p => p.id === project.id);
      const updated = idx >= 0 
        ? projects.map(p => p.id === project.id ? project : p)
        : [project, ...projects];
      
      localStorage.setItem(KEYS.PROJECTS, JSON.stringify(updated));
      if (storage.getAuthToken()) {
          await api.post('/api/projects', project);
      }
  },

  deleteProject: async (id: string) => {
      const projects = storage.getProjectsSync().filter(p => p.id !== id);
      localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
      if (storage.getAuthToken()) {
          await api.delete(`/api/projects/${id}`);
      }
  },

  // --- Characters ---
  loadCharacters: async (): Promise<Character[]> => {
      if (storage.getAuthToken()) {
          const serverData = await api.get('/api/characters');
          if (serverData) {
              localStorage.setItem(KEYS.CHARACTERS, JSON.stringify(serverData));
              return serverData;
          }
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
      if (storage.getAuthToken()) {
          await api.post('/api/characters', chars);
      }
  },

  // --- Settings ---
  loadSettings: async (): Promise<Settings> => {
      if (storage.getAuthToken()) {
          const serverData = await api.get('/api/settings');
          if (serverData && Object.keys(serverData).length > 0) {
               const merged = { ...DEFAULT_SETTINGS, ...serverData };
               localStorage.setItem(KEYS.SETTINGS, JSON.stringify(merged));
               return merged;
          }
      }
      return storage.getSettingsSync();
  },

  getSettingsSync: (): Settings => {
    const data = localStorage.getItem(KEYS.SETTINGS);
    let localSettings = data ? JSON.parse(data) : DEFAULT_SETTINGS;
    
    // Migration: Handle old array format
    if (localSettings.apiKeys && Array.isArray(localSettings.apiKeys)) {
        localSettings.apiKey = localSettings.apiKeys[0] || '';
        delete localSettings.apiKeys;
    }

    if (!localSettings.baseUrl) localSettings.baseUrl = DEFAULT_SETTINGS.baseUrl;
    if (localSettings.apiKey === undefined) localSettings.apiKey = '';

    return { ...DEFAULT_SETTINGS, ...localSettings };
  },

  getSettings: (): Settings => {
    return storage.getSettingsSync();
  },

  saveSettings: async (settings: Settings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    if (storage.getAuthToken()) {
        await api.post('/api/settings', settings);
    }
  },

  // --- Auth ---
  setAuth: (token: string, user: any) => {
      localStorage.setItem(KEYS.AUTH_TOKEN, token);
      localStorage.setItem(KEYS.AUTH_USER, JSON.stringify(user));
  },

  getAuthToken: () => {
      return localStorage.getItem(KEYS.AUTH_TOKEN);
  },
  
  getAuthUser: () => {
      const u = localStorage.getItem(KEYS.AUTH_USER);
      return u ? JSON.parse(u) : null;
  },

  clearAuth: () => {
      localStorage.removeItem(KEYS.AUTH_TOKEN);
      localStorage.removeItem(KEYS.AUTH_USER);
      // Optional: Clear data on logout if desired
  },
  
  getProjects: () => storage.getProjectsSync(),
  getCharacters: () => storage.getCharactersSync(),
};

export const getSettings = storage.getSettingsSync;
