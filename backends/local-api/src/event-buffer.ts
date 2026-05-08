/**
 * Event Buffer
 * 
 * Buffers incoming analytics events and flushes them in batches to prevent
 * database overload. Implements automatic flushing based on buffer size
 * and time interval.
 */

import type { AnalyticsEvent } from './events.js';

export interface EventBufferConfig {
  maxSize?: number;
  flushIntervalMs?: number;
  onFlush: (events: AnalyticsEvent[]) => Promise<void>;
}

export class EventBuffer {
  private buffer: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly maxSize: number;
  private readonly flushIntervalMs: number;
  private readonly onFlush: (events: AnalyticsEvent[]) => Promise<void>;
  private isFlushingNow = false;

  constructor(config: EventBufferConfig) {
    this.maxSize = config.maxSize ?? 1000;
    this.flushIntervalMs = config.flushIntervalMs ?? 5000;
    this.onFlush = config.onFlush;
    this.startAutoFlush();
  }

  /**
   * Adds an event to the buffer. Triggers immediate flush if buffer is full.
   */
  add(event: AnalyticsEvent): void {
    this.buffer.push(event);
    
    if (this.buffer.length >= this.maxSize) {
      // Fire-and-forget flush to avoid blocking the ingestion endpoint
      void this.flush();
    }
  }

  /**
   * Adds multiple events to the buffer efficiently
   */
  addBatch(events: AnalyticsEvent[]): void {
    this.buffer.push(...events);
    
    if (this.buffer.length >= this.maxSize) {
      void this.flush();
    }
  }

  /**
   * Flushes all buffered events to the database
   */
  async flush(): Promise<void> {
    // Prevent concurrent flushes
    if (this.isFlushingNow) {
      return;
    }

    if (this.buffer.length === 0) {
      return;
    }

    this.isFlushingNow = true;
    const toFlush = [...this.buffer];
    this.buffer = [];

    try {
      await this.onFlush(toFlush);
      console.log(`[EventBuffer] Flushed ${toFlush.length} events`);
    } catch (err) {
      console.error('[EventBuffer] Failed to flush events:', err);
      // Re-add failed events to the front of the buffer for retry
      // But limit the retry buffer to prevent memory overflow
      const retryEvents = toFlush.slice(0, this.maxSize);
      this.buffer.unshift(...retryEvents);
      
      if (toFlush.length > this.maxSize) {
        console.error(`[EventBuffer] Dropped ${toFlush.length - this.maxSize} events due to repeated failures`);
      }
    } finally {
      this.isFlushingNow = false;
    }
  }

  /**
   * Starts automatic periodic flushing
   */
  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Stops the buffer and flushes any remaining events
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    await this.flush();
  }

  /**
   * Gets current buffer size (for monitoring)
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}
