type EventHandler = (data?: any) => void;

class EventEmitter {
  private events: { [key: string]: EventHandler[] } = {};

  subscribe(event: string, handler: EventHandler): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);

    // Return an unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter(h => h !== handler);
    };
  }

  publish(event: string, data?: any): void {
    const handlers = this.events[event];
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}

export const fileTreeEvents = new EventEmitter();
