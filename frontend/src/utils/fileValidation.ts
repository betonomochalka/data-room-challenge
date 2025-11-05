/**
 * Shared file validation utilities for frontend
 * Centralizes file type validation logic to prevent duplication
 */

import bytes from 'bytes';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.google-apps.document', // Google Docs (exported as PDF)
  'application/vnd.google-apps.spreadsheet', // Google Sheets (exported as XLSX)
] as const;

export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'docx'] as const;

export const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB in bytes

/**
 * Validate if a file type is allowed based on mime type and/or file extension
 */
export function isValidFileType(mimeType: string, fileName: string): boolean {
  const fileExtension = fileName.split('.').pop()?.toLowerCase();
  return (
    ALLOWED_MIME_TYPES.includes(mimeType as any) ||
    (fileExtension !== undefined && ALLOWED_EXTENSIONS.includes(fileExtension as any))
  );
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string | undefined {
  return fileName.split('.').pop()?.toLowerCase();
}

/**
 * Validate file type and return error message if invalid
 */
export function validateFileType(mimeType: string, fileName: string): { valid: boolean; error?: string } {
  if (!isValidFileType(mimeType, fileName)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPG, PNG, PDF, XLSX, and DOCX files are allowed.',
    };
  }
  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize: number, maxSize: number = MAX_FILE_SIZE): { valid: boolean; error?: string } {
  if (fileSize > maxSize) {
    return {
      valid: false,
      error: `File size exceeds the maximum limit of ${formatBytes(maxSize)}. Please choose a smaller file.`,
    };
  }
  return { valid: true };
}

/**
 * Format bytes to human readable string using bytes package
 */
function formatBytes(bytesValue: number, decimals = 2): string {
  const result = bytes(bytesValue, { decimalPlaces: decimals });
  return result || '0 Bytes';
}

