import { Project, Character, Settings, GenerationModel } from '../types';

const KEYS = {
  PROJECTS: 'baojian_projects',
  CHARACTERS: 'baojian_characters',
  SETTINGS: 'baojian_settings',
  AUTH_TOKEN: 'baojian_auth_token',
  AUTH_USER: 'baojian_auth_user'
};

const DEFAULT_SETTINGS: Settings = {
  apiKeys: [], 
  baseUrl: 'https://bj.nfai.lol', 
  textModel: 'gemini-2.5-flash', 
  imageModel: GenerationModel.GEMINI_2_5_FLASH_IMAGE,
  jianYingPath: 'C:/Users/Admin/AppData/Local/JianYingPro/User Data/Projects/',
  outputImgPath: 'D:/AI_Output/',
  themeColor: '#f97316'
};

// API Helper with Interceptor
const api = {
    getHeaders: () => {
        const token = localStorage.getItem(KEYS.AUTH_TOKEN);
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    },

    handleResponse: async (res: Response) => {
        if (res.status === 401) {
            // Token expired or invalid
            localStorage.removeItem(KEYS.AUTH_TOKEN);
            window.location.reload(); // Force re-login
            return null;
        }
        const contentType = res.headers.get("content-type");
        if (!res.ok || !contentType || !contentType.includes("application/json")) {
            return null;
        }
        return await res.json();
    },

    get: async (url: string) => {
        try {
            const res = await fetch(url, { headers: api.getHeaders() });
            return await api.handleResponse(res);
        } catch (e) {
            return null;
        }
    },
    post: async (url: string, data: any) => {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: api.getHeaders(),
                body: JSON.stringify(data)
            });
            return await api.handleResponse(res);
        } catch (e) {
            return null;
        }
    },
    delete: async (url: string) => {
        try {
            await fetch(url, { method: 'DELETE', headers: api.getHeaders() });
        } catch (e) { }
    }
};

export const storage = {
  // --- Auth ---
  setAuth: (token: string, user: any) => {
      localStorage.setItem(KEYS.AUTH_TOKEN, token);
      localStorage.setItem(KEYS.AUTH_USER, JSON.stringify(user));
  },
  
  clearAuth: () => {
      localStorage.removeItem(KEYS.AUTH_TOKEN);
      localStorage.removeItem(KEYS.AUTH_USER);
  },

  isAuthenticated: () => {
      return !!localStorage.getItem(KEYS.AUTH_TOKEN);
  },
  
  getUser: () => {
      const u = localStorage.getItem(KEYS.AUTH_USER);
      return u ? JSON.parse(u) : null;
  },

  // --- Projects ---
  loadProjects: async (): Promise<Project[]> => {
      const serverData = await api.get('/api/projects');
      if (serverData) {
          localStorage.setItem(KEYS.PROJECTS, JSON.stringify(serverData));
          return serverData;
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
           if (!merged.apiKeys || merged.apiKeys.length === 0) merged.apiKeys = DEFAULT_SETTINGS.apiKeys;
           if (!merged.baseUrl) merged.baseUrl = DEFAULT_SETTINGS.baseUrl;
           localStorage.setItem(KEYS.SETTINGS, JSON.stringify(merged));
           return merged;
      }
      return storage.getSettingsSync();
  },

  getSettingsSync: (): Settings => {
    const data = localStorage.getItem(KEYS.SETTINGS);
    const localSettings = data ? JSON.parse(data) : DEFAULT_SETTINGS;
    if (!localSettings.baseUrl) localSettings.baseUrl = DEFAULT_SETTINGS.baseUrl;
    return { ...DEFAULT_SETTINGS, ...localSettings };
  },

  getSettings: (): Settings => {
    return storage.getSettingsSync();
  },

  saveSettings: async (settings: Settings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    await api.post('/api/settings', settings);
  },
  
  getProjects: () => storage.getProjectsSync(),
  getCharacters: () => storage.getCharactersSync(),
};

export const getSettings = storage.getSettingsSync;