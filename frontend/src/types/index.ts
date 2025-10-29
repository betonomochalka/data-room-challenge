export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataRoom {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    folders: number;
  };
  folders?: Folder[];
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  dataRoomId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    children: number;
    files: number;
  };
  children?: Folder[];
  files?: File[];
}

export interface FolderWithChildren extends Folder {
  children: Folder[];
  files: File[];
}

export interface File {
  id: string;
  name: string;
  fileType?: string; // Frontend field
  mimeType?: string; // Database field
  size?: number | null; // Frontend field
  fileSize?: number | string | null; // Database field (BigInt serialized as string)
  folderId: string;
  blobUrl?: string; // Frontend field
  filePath?: string; // Database field
  createdAt: string;
  updatedAt: string;
  folder?: {
    id: string;
    name: string;
    dataRoomId: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
  message: string;
}

