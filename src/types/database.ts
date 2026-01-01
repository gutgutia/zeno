import type { DashboardConfig } from './dashboard';

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  type: 'personal' | 'team';
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface DataSource {
  type: 'paste' | 'upload' | 'google_sheets' | 'airtable';
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  // Future: sheetId, tableId, syncConfig, etc.
}

export interface Dashboard {
  id: string;
  workspace_id: string;
  title: string;
  slug: string;
  description: string | null;
  data_source: DataSource;
  data: Record<string, unknown>[] | null;
  data_url: string | null;
  config: DashboardConfig;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  dashboard_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// Supabase Database type (for client generation)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      workspaces: {
        Row: Workspace;
        Insert: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Workspace, 'id' | 'owner_id'>>;
      };
      dashboards: {
        Row: Dashboard;
        Insert: Omit<Dashboard, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Dashboard, 'id' | 'workspace_id'>>;
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: Omit<ChatMessage, 'id' | 'created_at'>;
        Update: Partial<Omit<ChatMessage, 'id' | 'dashboard_id'>>;
      };
    };
  };
}
