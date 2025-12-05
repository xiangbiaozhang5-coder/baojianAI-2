import { Project, Character, Settings, GenerationModel } from '../types';

const KEYS = {
  PROJECTS: 'baojian_projects',
  CHARACTERS: 'baojian_characters',
  SETTINGS: 'baojian_settings'
};

const DEFAULT_SETTINGS: Settings = {
  apiKeys: [], // Empty by default, triggers AuthModal
  textModel: 'gemini-3-pro-preview',
  imageModel: GenerationModel.GEMINI_2_5_FLASH_IMAGE,
  jianYingPath: 'C:/Users/Admin/AppData/Local/JianYingPro/User Data/Projects/',
  outputImgPath: 'D:/AI_Output/',
  themeColor: '#f97316' // Default Orange
};

export const storage = {
  getProjects: (): Project[] => {
    const data = localStorage.getItem(KEYS.PROJECTS);
    return data ? JSON.parse(data) : [];
  },
  saveProjects: (projects: Project[]) => {
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
  },
  getCharacters: (): Character[] => {
    const data = localStorage.getItem(KEYS.CHARACTERS);
    return data ? JSON.parse(data) : [];
  },
  saveCharacters: (chars: Character[]) => {
    localStorage.setItem(KEYS.CHARACTERS, JSON.stringify(chars));
  },
  getSettings: (): Settings => {
    const data = localStorage.getItem(KEYS.SETTINGS);
    if (!data) return DEFAULT_SETTINGS;
    
    const parsed = JSON.parse(data);
    
    // Migration: Convert legacy 'apiKey' to 'apiKeys'
    if (parsed.apiKey && (!parsed.apiKeys || parsed.apiKeys.length === 0)) {
        parsed.apiKeys = [parsed.apiKey];
        delete parsed.apiKey;
    }
    
    // Cleanup: Remove baseUrl if present from legacy
    if (parsed.baseUrl) {
        delete parsed.baseUrl;
    }

    return { ...DEFAULT_SETTINGS, ...parsed };
  },
  saveSettings: (settings: Settings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  }
};