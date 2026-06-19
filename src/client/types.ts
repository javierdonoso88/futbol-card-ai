export type Role = 'CFO' | 'CTO' | 'COO' | 'CEO';

export interface CardStats {
  overall: number;
  stat1: number; label1: string;
  stat2: number; label2: string;
  stat3: number; label3: string;
  stat4: number; label4: string;
  stat5: number; label5: string;
  stat6: number; label6: string;
}

export interface GenerateResponse {
  imageBase64: string | null;
  mimeType: string;
  stats: CardStats;
  playerName: string;
  fallback: boolean;
  fallbackReason?: string;
}

export interface UploadState {
  imageBase64: string;
  mimeType: string;
  preview: string;
}

export interface FormState {
  upload: UploadState | null;
  role: Role;
  skill: string;
  leadershipStyle: string;
  playerName: string;
}
