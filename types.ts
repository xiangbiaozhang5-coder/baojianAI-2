
export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export enum GenerationModel {
  GEMINI_2_5_FLASH_IMAGE = 'gemini-2.5-flash-image',
  GEMINI_3_PRO_IMAGE_PREVIEW = 'gemini-3-pro-image-preview',
}

export const TEXT_MODELS = [
  { value: 'gemini-3.0-pro-preview', label: 'Gemini 3.0 Pro' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
];

export interface Settings {
  apiKey: string; // Changed from apiKeys[] to single string
  baseUrl: string;
  textModel: string;
  imageModel: GenerationModel;
  jianYingPath: string;
  outputImgPath: string;
  themeColor: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  referenceImage?: string;
}

export interface StyleReference {
  id: string;
  name: string;
  imageUrl: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  status: '草稿' | '生成中' | '已完成';
  localCharacters: Character[];
  styles?: StyleReference[];
  activeStyleId?: string;
  frames: StoryboardFrame[];
  promptPrefix?: string;
}

export interface StoryboardFrame {
  id: string;
  scriptContent: string;
  visualPrompt?: string;
  characterIds: string[];
  imageUrl?: string;
  isMirrored?: boolean;
  isHD?: boolean;
  aspectRatio: AspectRatio;
  model: GenerationModel;
  startTime?: string;
  endTime?: string;
  selected?: boolean;
}

export type ViewState = 'drafts' | 'characters' | 'settings' | 'editor';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface AuthUser {
  type: 'admin' | 'user' | 'vip';
  expiresAt: number;
}
