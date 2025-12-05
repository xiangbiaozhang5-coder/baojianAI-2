import { Project, Character, Settings, GenerationModel } from '../types';

const KEYS = {
  PROJECTS: 'baojian_projects',
  CHARACTERS: 'baojian_characters',
  SETTINGS: 'baojian_settings'
};

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  baseUrl: 'https://generativelanguage.googleapis.com',
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
    // Merge with DEFAULT_SETTINGS to ensure new defaults (like updated models/url) apply if keys are missing
    // or if the user resets. However, for existing users, we might want to override invalid defaults.
    // Ideally, UI settings modal allows changing it.
    // Here we ensure fallback is the new default.
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
  },
  saveSettings: (settings: Settings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  }
};