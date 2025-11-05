import { EventEmitter } from 'eventemitter3';

// Create a typed event emitter for file tree events
class FileTreeEventEmitter extends EventEmitter {
  // Wrapper to match original API - subscribe returns unsubscribe function
  subscribe(event: string, handler: (...args: any[]) => void): () => void {
    this.on(event, handler);
    // Return unsubscribe function
    return () => {
      this.off(event, handler);
    };
  }

  // Alias for publish -> emit
  publish(event: string, ...args: any[]): void {
    this.emit(event, ...args);
  }
}

export const fileTreeEvents = new FileTreeEventEmitter();
