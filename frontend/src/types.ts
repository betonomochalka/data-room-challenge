// Shared types for the entire application

export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export interface DataRoom {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    folders?: number;
    files?: number;
  };
}

export interface Folder {
  id: string;
  name: string;
  dataRoomId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  parent?: Folder | null;
  _count?: {
    subfolders?: number;
    files?: number;
  };
}

export interface File {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedBy: string;
  folderId: string;
  dataRoomId: string;
  createdAt: string;
  updatedAt: string;
  folder?: Folder;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SharePermission {
  id: string;
  email: string;
  role: 'viewer' | 'editor';
  dataRoomId?: string | null;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

