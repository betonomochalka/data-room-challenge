/**
 * Shared file validation utilities
 * Centralizes file type validation logic to prevent duplication
 */

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

