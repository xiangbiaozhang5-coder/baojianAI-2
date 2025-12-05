export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export enum GenerationModel {
  NANOBANANA = 'gemini-2.5-flash-image',
  NANOBANANA_PRO = 'gemini-3-pro-image-preview',
}

export const TEXT_MODELS = [
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude 3.5 Sonnet' },
];

export interface Settings {
  apiKey: string;
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
  description: string; // 角色外貌描述
  referenceImage?: string; // Base64
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  status: '草稿' | '生成中' | '已完成';
  localCharacters: Character[]; // 故事专用角色库
  frames: StoryboardFrame[];
  promptPrefix?: string; // 全局画面描述词前缀
}

export interface StoryboardFrame {
  id: string;
  scriptContent: string; // Row 1: 剧本/分镜内容
  visualPrompt?: string; // Row 2: 画面描述词
  characterIds: string[]; // Row 3: 关联角色ID
  imageUrl?: string; // Row 4: 图片
  isMirrored?: boolean; // 图片镜像状态
  isHD?: boolean; // 是否高清
  aspectRatio: AspectRatio;
  model: GenerationModel;
  startTime?: string; // SRT Timecode
  endTime?: string;
  selected?: boolean; // UI Selection state
}

export type ViewState = 'drafts' | 'characters' | 'settings' | 'editor';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}