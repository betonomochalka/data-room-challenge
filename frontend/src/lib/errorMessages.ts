/**
 * User-friendly error message utility
 * Converts technical errors into clear, actionable messages
 */

import { isAxiosError } from 'axios';

export interface ErrorResponse {
  code?: string;
  response?: {
    status?: number;
    data?: {
      error?: string;
      message?: string;
    };
  };
  message?: string;
}

export const ERROR_MESSAGES = {
  // Network errors
  NETWORK: 'Unable to connect. Please check your internet connection and try again.',
  TIMEOUT: 'Request timed out. Please try again.',
  
  // Authentication errors
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  FORBIDDEN: 'You don\'t have permission to perform this action.',
  
  // Resource errors
  NOT_FOUND: 'The requested item could not be found. It may have been deleted.',
  DUPLICATE: 'An item with this name already exists. Please choose a different name.',
  
  // Validation errors
  INVALID_INPUT: 'Invalid input. Please check your data and try again.',
  REQUIRED_FIELD: 'Please fill in all required fields.',
  FILE_TOO_LARGE: 'File size exceeds the maximum limit of 100MB. Please choose a smaller file.',
  INVALID_FILE_TYPE: 'This file type is not supported. Please choose a different file.',
  
  // Server errors
  SERVER_ERROR: 'Something went wrong on our end. Please try again in a few moments.',
  DATABASE_ERROR: 'Database error occurred. Please try again.',
  
  // Generic
  UNKNOWN: 'An unexpected error occurred. Please try again.',
} as const;

/**
 * Get user-friendly error message from error object
 */
export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    if (error.response) {
      // Use a switch statement for clearer status code handling
      switch (error.response.status) {
        case 400:
          return error.response.data.message || ERROR_MESSAGES.INVALID_INPUT;
        case 401:
          return ERROR_MESSAGES.UNAUTHORIZED;
        case 403:
          return ERROR_MESSAGES.FORBIDDEN;
        case 404:
          return ERROR_MESSAGES.NOT_FOUND;
        case 409:
          return error.response.data.message || ERROR_MESSAGES.DUPLICATE;
        case 413:
          return ERROR_MESSAGES.FILE_TOO_LARGE;
        case 500:
          return ERROR_MESSAGES.SERVER_ERROR;
        default:
          // For other client/server error codes, use the backend message if available
          if (error.response.data && error.response.data.message) {
            return error.response.data.message;
          }
          return `Error: ${error.response.status} ${error.response.statusText}`;
      }
    } else if (error.request) {
      // The request was made but no response was received
      return ERROR_MESSAGES.NETWORK;
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  // Fallback for other types of errors
  return 'An unexpected error occurred.';
}

/**
 * Get success message for operations
 */
export const SUCCESS_MESSAGES = {
  DATA_ROOM_CREATED: 'Data room created successfully!',
  DATA_ROOM_DELETED: 'Data room deleted successfully!',
  DATA_ROOM_UPDATED: 'Data room updated successfully!',
  
  FOLDER_CREATED: 'Folder created successfully!',
  FOLDER_DELETED: 'Folder deleted successfully!',
  FOLDER_RENAMED: 'Folder renamed successfully!',
  
  FILE_UPLOADED: 'File uploaded successfully!',
  FILE_DELETED: 'File deleted successfully!',
  FILE_RENAMED: 'File renamed successfully!',
  FILE_DOWNLOADED: 'File downloaded successfully!',
  
  LOGIN_SUCCESS: 'Successfully logged in!',
  LOGOUT_SUCCESS: 'Logged out successfully!',
  SIGNUP_SUCCESS: 'Account created successfully!',
} as const;

/**
 * Get loading message for operations
 */
export const LOADING_MESSAGES = {
  CREATING_DATA_ROOM: 'Creating data room...',
  DELETING_DATA_ROOM: 'Deleting data room...',
  
  CREATING_FOLDER: 'Creating folder...',
  DELETING_FOLDER: 'Deleting folder...',
  RENAMING_FOLDER: 'Renaming folder...',
  
  UPLOADING_FILE: 'Uploading file...',
  DELETING_FILE: 'Deleting file...',
  RENAMING_FILE: 'Renaming file...',
  DOWNLOADING_FILE: 'Downloading file...',
  
  LOADING: 'Loading...',
  SAVING: 'Saving...',
} as const;

/**
 * Format error for logging
 */
export const formatErrorForLogging = (error: ErrorResponse, context?: string): string => {
  const parts = [];
  
  if (context) {
    parts.push(`[${context}]`);
  }
  
  parts.push(error.message || 'Unknown error');
  
  if (error.code) {
    parts.push(`(${error.code})`);
  }
  
  if (error.response?.status) {
    parts.push(`[HTTP ${error.response.status}]`);
  }
  
  return parts.join(' ');
};

