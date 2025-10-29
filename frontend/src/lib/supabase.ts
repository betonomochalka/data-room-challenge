import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface DataRoom {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  data_room_id: string;
  parent_folder_id?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: string;
  name: string;
  data_room_id: string;
  folder_id?: string;
  user_id: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  updated_at: string;
}