import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number | string, decimals = 2) {
  // Convert string to number if needed (handles BigInt serialization)
  const numBytes = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  
  if (isNaN(numBytes) || numBytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(numBytes) / Math.log(k));

  return parseFloat((numBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(date: string | Date) {
  if (!date) return 'Unknown date';
  
  // Handle different date formats that might come from the API
  let d: Date;
  
  if (typeof date === 'string') {
    // Try to parse the date string
    d = new Date(date);
    
    // If the date is invalid, try to handle common formats
    if (isNaN(d.getTime())) {
      // If it's a timestamp string, try parsing as number
      const timestamp = parseInt(date);
      if (!isNaN(timestamp)) {
        d = new Date(timestamp);
      } else {
        // If all else fails, return a fallback
        return 'Invalid date';
      }
    }
  } else {
    d = new Date(date);
  }
  
  // Check if the date is still invalid
  if (isNaN(d.getTime())) {
    return 'Invalid date';
  }
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

