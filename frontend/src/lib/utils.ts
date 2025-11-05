import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import bytes from "bytes";
import { format, isValid, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytesValue: number | string, decimals = 2) {
  // Convert string to number if needed (handles BigInt serialization)
  const numBytes = typeof bytesValue === 'string' ? parseInt(bytesValue) : bytesValue;
  
  if (isNaN(numBytes) || numBytes === 0) return '0 Bytes';

  // Use bytes package for formatting
  const result = bytes(numBytes, { decimalPlaces: decimals });
  return result || '0 Bytes';
}

export function formatDate(date: string | Date) {
  if (!date) return 'Unknown date';
  
  // Handle different date formats that might come from the API
  let d: Date;
  
  if (typeof date === 'string') {
    // Try to parse ISO date string first
    d = parseISO(date);
    
    // If the date is invalid, try to handle common formats
    if (!isValid(d)) {
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
    d = date;
  }
  
  // Check if the date is still invalid
  if (!isValid(d)) {
    return 'Invalid date';
  }
  
  // Use date-fns format function
  return format(d, 'MMM d, yyyy h:mm a');
}

