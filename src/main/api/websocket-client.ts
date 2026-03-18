// ============================================================================
// GigaCore Command — WebSocket Client for Gen2 Real-Time Status
// Provides auto-reconnecting WebSocket with topic-based subscriptions.
// Runs in the Electron main process.
// ============================================================================

import WebSocket from 'ws';
import { EventEmitter } from 'events';

import { WsTopic, WsConnectionState, WsMessage } from './api-types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Initial reconnect delay in milliseconds. */
const INITIAL_RECONNECT_DELAY_MS = 1000;
/** Maximum reconnect delay (cap for exponential backoff). */
const MAX_RECONNECT_DELAY_MS = 30_000;
/** How often to send a ping to detect dead connections. */
const HEARTBEAT_INTERVAL_MS = 30_000;
/** How long to wait for a pong before considering the connection dead. */
const PONG_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// GigaCoreWebSocket
// ---------------------------------------------------------------------------

export class GigaCoreWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private ip: string;
  private _connectionState: WsConnectionState = 'disconnected';
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  constructor(ip: string, options?: { maxReconnectAttempts?: number }) {
    super();
    this.ip = ip;
    if (options?.maxReconnectAttempts !== undefined) {
      this.maxReconnectAttempts = options.maxReconnectAttempts;
    }
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Open a WebSocket connection to the GigaCore switch.
   * Resolves when the connection is established, rejects on failure.
   */
  async connect(): Promise<void> {
    if (this.ws && this._connectionState === 'connected') {
      return; // Already connected
    }

    this.intentionalDisconnect = false;
    this.setConnectionState('connecting');

    return new Promise<void>((resolve, reject) => {
      const url = `ws://${this.ip}/ws`;

      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        this.setConnectionState('disconnected');
        reject(err);
        return;
      }

      const onOpen = (): void => {
        cleanup();
        this.resetReconnect();
        this.setConnectionState('connected');
        this.startHeartbeat();

        // Re-subscribe to any existing topics
        for (const topic of this.subscriptions.keys()) {
          this.sendSubscribe(topic);
        }

        this.emit('connected');
        resolve();
      };

      const onError = (err: Error): void => {
        cleanup();
        this.setConnectionState('disconnected');
        reject(err);
      };

      const cleanup = (): void => {
        this.ws?.removeListener('open', onOpen);
        this.ws?.removeListener('error', onError);
        // Attach persistent handlers after initial connection
        this.attachHandlers();
      };

      this.ws.once('open', onOpen);
      this.ws.once('error', onError);
    });
  }

  /**
   * Cleanly close the WebSocket connection. No automatic reconnect will occur.
   */
  disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.ws) {
      // Remove all listeners before closing to prevent handleClose from reconnecting.
      this.ws.removeAllListeners();
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }

    this.setConnectionState('disconnected');
    this.emit('disconnected');
  }

  /**
   * Subscribe to a real-time topic.
   * Valid topics: 'ports', 'poe', 'system', 'groups', 'lldp'.
   *
   * @returns An unsubscribe function. Call it to remove this specific callback.
   */
  subscribe(topic: string, callback: (data: any) => void): () => void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(callback);

    // If already connected, tell the switch we want this topic
    if (this._connectionState === 'connected') {
      this.sendSubscribe(topic);
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(topic);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(topic);
          if (this._connectionState === 'connected') {
            this.sendUnsubscribe(topic);
          }
        }
      }
    };
  }

  /**
   * Whether the WebSocket is currently open and connected.
   */
  get isConnected(): boolean {
    return this._connectionState === 'connected';
  }

  /**
   * Current connection state.
   */
  get connectionState(): WsConnectionState {
    return this._connectionState;
  }

  // =========================================================================
  // Internal: message handling
  // =========================================================================

  private attachHandlers(): void {
    if (!this.ws) return;

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.handleClose(code, reason.toString());
    });

    this.ws.on('error', (err: Error) => {
      this.emit('error', err);
    });

    this.ws.on('pong', () => {
      this.clearPongTimeout();
    });
  }

  private handleMessage(data: WebSocket.Data): void {
    let message: WsMessage;

    try {
      const raw = typeof data === 'string' ? data : data.toString('utf-8');
      message = JSON.parse(raw) as WsMessage;
    } catch {
      // Non-JSON message — ignore
      return;
    }

    if (!message.topic) return;

    // Emit a typed event like 'port:change', 'poe:change', etc.
    // Strip trailing 's' for the event name (ports -> port, groups -> group)
    const eventTopic = message.topic.endsWith('s')
      ? message.topic.slice(0, -1)
      : message.topic;
    this.emit(`${eventTopic}:change`, message.data);

    // Notify topic subscribers
    const subs = this.subscriptions.get(message.topic);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(message.data);
        } catch (err) {
          this.emit('error', err);
        }
      }
    }
  }

  private handleClose(code: number, reason: string): void {
    this.stopHeartbeat();
    this.ws = null;

    if (this.intentionalDisconnect) {
      this.setConnectionState('disconnected');
      return;
    }

    this.emit('close', { code, reason });
    this.attemptReconnect();
  }

  // =========================================================================
  // Internal: reconnection with exponential backoff
  // =========================================================================

  private attemptReconnect(): void {
    if (this.intentionalDisconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setConnectionState('disconnected');
      this.emit('reconnect:failed', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });
      return;
    }

    this.setConnectionState('reconnecting');

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS,
    );

    this.reconnectAttempts++;

    this.emit('reconnect:attempt', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.emit('reconnect:success', {
          attempt: this.reconnectAttempts,
        });
      } catch {
        // connect() failed — handleClose will fire and retry
      }
    }, delay);
  }

  private resetReconnect(): void {
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // =========================================================================
  // Internal: heartbeat / keep-alive
  // =========================================================================

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();

        // Set a timer: if we don't get pong back, connection is dead
        this.pongTimeout = setTimeout(() => {
          if (this.ws) {
            this.ws.terminate(); // force-close; will trigger handleClose -> reconnect
          }
        }, PONG_TIMEOUT_MS);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clearPongTimeout();
  }

  private clearPongTimeout(): void {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  // =========================================================================
  // Internal: subscription messages
  // =========================================================================

  private sendSubscribe(topic: string): void {
    this.sendJson({ action: 'subscribe', topic });
  }

  private sendUnsubscribe(topic: string): void {
    this.sendJson({ action: 'unsubscribe', topic });
  }

  private sendJson(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  // =========================================================================
  // Internal: state management
  // =========================================================================

  private setConnectionState(state: WsConnectionState): void {
    if (this._connectionState !== state) {
      const prev = this._connectionState;
      this._connectionState = state;
      this.emit('state:change', { from: prev, to: state });
    }
  }
}
