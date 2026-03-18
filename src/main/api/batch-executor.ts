// ============================================================================
// GigaCore Command — Batch Operation Executor
// Queued batch operations with progress reporting, abort, and rollback.
// Runs in the Electron main process.
// ============================================================================

import { EventEmitter } from 'events';

import { GigaCoreClient } from './gigacore-client';
import {
  ApiError,
  ApiErrorCode,
  BatchOperation,
  BatchResult,
  BatchProgress,
} from './api-types';

// ---------------------------------------------------------------------------
// Simple promise-based concurrency queue (avoids needing p-queue dependency)
// ---------------------------------------------------------------------------

class ConcurrencyQueue {
  private active = 0;
  private pending: Array<() => void> = [];

  constructor(private concurrency: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.pending.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.pending.shift();
    if (next) next();
  }

  clear(): void {
    this.pending = [];
  }
}

// ---------------------------------------------------------------------------
// Operation handler registry
// ---------------------------------------------------------------------------

/**
 * Maps operation names to handler functions.
 * Each handler receives a GigaCoreClient and params, and optionally returns
 * rollback data that can be used to undo the operation.
 */
type OperationHandler = (
  client: GigaCoreClient,
  params: any,
) => Promise<any | undefined>;

const OPERATION_HANDLERS: Record<string, OperationHandler> = {
  // Port operations
  'port.setEnabled': async (client, params) => {
    const current = await client.getPort(params.port);
    await client.setPortEnabled(params.port, params.enabled);
    return { port: params.port, enabled: current.adminStatus === 'up' };
  },
  'port.setLabel': async (client, params) => {
    const current = await client.getPort(params.port);
    await client.setPortLabel(params.port, params.label);
    return { port: params.port, label: current.label };
  },
  'port.setSpeed': async (client, params) => {
    const current = await client.getPort(params.port);
    await client.setPortSpeed(params.port, params.speed);
    return { port: params.port, speed: current.speed };
  },
  'port.setGroup': async (client, params) => {
    const current = await client.getPort(params.port);
    await client.setPortGroup(params.port, params.groupId);
    return { port: params.port, groupId: current.groupId };
  },
  'port.setTrunk': async (client, params) => {
    const current = await client.getPort(params.port);
    await client.setPortTrunk(params.port, params.groupIds);
    return { port: params.port, groupIds: current.trunkGroups };
  },

  // PoE operations
  'poe.setEnabled': async (client, params) => {
    const summary = await client.getPoeSummary();
    const portPoe = summary.ports.find((p) => p.port === params.port);
    await client.setPortPoe(params.port, params.enabled);
    return { port: params.port, enabled: portPoe?.enabled ?? false };
  },
  'poe.setPriority': async (client, params) => {
    await client.setPortPoePriority(params.port, params.priority);
    // No easy way to read previous priority on some models
    return undefined;
  },

  // Group operations
  'group.set': async (client, params) => {
    const current = await client.getGroup(params.id);
    await client.setGroup(params.id, params.config);
    return { id: params.id, config: current };
  },

  // IGMP operations
  'igmp.setSnooping': async (client, params) => {
    const config = await client.getIgmpConfig();
    const groupCfg = config.perGroup.find((g) => g.groupId === params.groupId);
    await client.setIgmpSnooping(params.groupId, params.enabled);
    return {
      groupId: params.groupId,
      enabled: groupCfg?.snoopingEnabled ?? false,
    };
  },
  'igmp.setQuerier': async (client, params) => {
    const config = await client.getIgmpConfig();
    const groupCfg = config.perGroup.find((g) => g.groupId === params.groupId);
    await client.setIgmpQuerier(params.groupId, params.enabled);
    return {
      groupId: params.groupId,
      enabled: groupCfg?.querierEnabled ?? false,
    };
  },

  // System operations
  'system.setName': async (client, params) => {
    const info = await client.getSystemInfo();
    await client.setSystemName(params.name);
    return { name: info.name };
  },
  'system.reboot': async (client) => {
    await client.reboot();
    return undefined; // Cannot roll back a reboot
  },

  // Profile operations
  'profile.recall': async (client, params) => {
    await client.recallProfile(params.slot);
    return undefined;
  },
  'profile.store': async (client, params) => {
    await client.storeProfile(params.slot, params.name);
    return undefined;
  },

  // IP configuration
  'ip.setConfig': async (client, params) => {
    const current = await client.getIpConfig();
    await client.setIpConfig(params.config);
    return { config: current };
  },
};

// ---------------------------------------------------------------------------
// Rollback handler registry
// ---------------------------------------------------------------------------

const ROLLBACK_HANDLERS: Record<string, OperationHandler> = {
  'port.setEnabled': async (client, rollback) => {
    await client.setPortEnabled(rollback.port, rollback.enabled);
  },
  'port.setLabel': async (client, rollback) => {
    await client.setPortLabel(rollback.port, rollback.label);
  },
  'port.setSpeed': async (client, rollback) => {
    await client.setPortSpeed(rollback.port, rollback.speed);
  },
  'port.setGroup': async (client, rollback) => {
    if (rollback.groupId !== undefined) {
      await client.setPortGroup(rollback.port, rollback.groupId);
    }
  },
  'port.setTrunk': async (client, rollback) => {
    if (rollback.groupIds) {
      await client.setPortTrunk(rollback.port, rollback.groupIds);
    }
  },
  'poe.setEnabled': async (client, rollback) => {
    await client.setPortPoe(rollback.port, rollback.enabled);
  },
  'group.set': async (client, rollback) => {
    await client.setGroup(rollback.id, rollback.config);
  },
  'igmp.setSnooping': async (client, rollback) => {
    await client.setIgmpSnooping(rollback.groupId, rollback.enabled);
  },
  'igmp.setQuerier': async (client, rollback) => {
    await client.setIgmpQuerier(rollback.groupId, rollback.enabled);
  },
  'system.setName': async (client, rollback) => {
    await client.setSystemName(rollback.name);
  },
  'ip.setConfig': async (client, rollback) => {
    await client.setIpConfig(rollback.config);
  },
};

// ---------------------------------------------------------------------------
// BatchExecutor
// ---------------------------------------------------------------------------

export class BatchExecutor extends EventEmitter {
  private queue: ConcurrencyQueue;
  private results: BatchResult[] = [];
  private aborted = false;
  private _isRunning = false;
  private _progress: BatchProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    current: '',
  };

  /** Cache of GigaCoreClient instances keyed by switch IP. */
  private clientCache: Map<string, GigaCoreClient> = new Map();

  constructor(options?: { concurrency?: number }) {
    super();
    this.queue = new ConcurrencyQueue(options?.concurrency || 2);
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Execute a batch of operations across one or more switches.
   *
   * @param operations  Array of operations to execute.
   * @param options.onProgress  Called after each operation completes.
   * @param options.stopOnError  If true, abort the batch on the first error.
   * @param options.backupFirst  If true, read current state before writing
   *                             (used for rollback data — enabled by default).
   * @returns Array of results, one per operation.
   */
  async execute(
    operations: BatchOperation[],
    options?: {
      onProgress?: (progress: BatchProgress) => void;
      stopOnError?: boolean;
      backupFirst?: boolean;
    },
  ): Promise<BatchResult[]> {
    if (this._isRunning) {
      throw new Error('BatchExecutor is already running');
    }

    this._isRunning = true;
    this.aborted = false;
    this.results = [];
    this._progress = {
      total: operations.length,
      completed: 0,
      failed: 0,
      current: '',
    };

    const backupFirst = options?.backupFirst !== false; // default true

    const promises = operations.map((op) =>
      this.queue.run(async () => {
        if (this.aborted) {
          const skipped: BatchResult = {
            switchIp: op.switchIp,
            operation: op.operation,
            success: false,
            error: 'Batch aborted',
          };
          this.results.push(skipped);
          return skipped;
        }

        this._progress.current = `${op.operation} on ${op.switchIp}`;
        this.emitProgress(options?.onProgress);

        const result = await this.executeOperation(op, backupFirst);
        this.results.push(result);

        if (result.success) {
          this._progress.completed++;
        } else {
          this._progress.failed++;

          if (options?.stopOnError) {
            this.abort();
          }
        }

        this.emitProgress(options?.onProgress);
        return result;
      }),
    );

    try {
      await Promise.all(promises);
    } finally {
      this._isRunning = false;
      this._progress.current = '';
      this.emit('complete', this.results);
    }

    return this.results;
  }

  /**
   * Abort the current batch. Already-running operations will complete,
   * but no new operations will start.
   */
  abort(): void {
    this.aborted = true;
    this.queue.clear();
    this.emit('aborted');
  }

  /**
   * Roll back completed operations using their stored rollback data.
   * Operations are rolled back in reverse order.
   */
  async rollback(results: BatchResult[]): Promise<void> {
    // Only rollback successful operations that have rollback data
    const rollbackable = results
      .filter((r) => r.success && r.rollbackData)
      .reverse();

    if (rollbackable.length === 0) return;

    this.emit('rollback:start', { count: rollbackable.length });

    for (const result of rollbackable) {
      try {
        const handler = ROLLBACK_HANDLERS[result.operation];
        if (!handler) {
          this.emit('rollback:skip', {
            operation: result.operation,
            reason: 'No rollback handler',
          });
          continue;
        }

        const client = this.getClient(result.switchIp);
        await handler(client, result.rollbackData);

        this.emit('rollback:success', {
          operation: result.operation,
          switchIp: result.switchIp,
        });
      } catch (err) {
        this.emit('rollback:error', {
          operation: result.operation,
          switchIp: result.switchIp,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.emit('rollback:complete');
  }

  /**
   * Whether the executor is currently processing a batch.
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Current progress of the running batch.
   */
  get progress(): BatchProgress {
    return { ...this._progress };
  }

  /**
   * Register or replace a GigaCoreClient for a given switch IP.
   * If not set, a default client is created automatically.
   */
  setClient(ip: string, client: GigaCoreClient): void {
    this.clientCache.set(ip, client);
  }

  // =========================================================================
  // Internal
  // =========================================================================

  private async executeOperation(
    op: BatchOperation,
    backupFirst: boolean,
  ): Promise<BatchResult> {
    const handler = OPERATION_HANDLERS[op.operation];

    if (!handler) {
      return {
        switchIp: op.switchIp,
        operation: op.operation,
        success: false,
        error: `Unknown operation: ${op.operation}`,
      };
    }

    try {
      const client = this.getClient(op.switchIp);
      const rollbackData = await handler(client, op.params);

      return {
        switchIp: op.switchIp,
        operation: op.operation,
        success: true,
        rollbackData: backupFirst ? rollbackData : undefined,
      };
    } catch (err) {
      return {
        switchIp: op.switchIp,
        operation: op.operation,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private getClient(ip: string): GigaCoreClient {
    let client = this.clientCache.get(ip);
    if (!client) {
      client = new GigaCoreClient(ip);
      this.clientCache.set(ip, client);
    }
    return client;
  }

  private emitProgress(onProgress?: (progress: BatchProgress) => void): void {
    const snapshot = this.progress;
    this.emit('progress', snapshot);
    if (onProgress) {
      onProgress(snapshot);
    }
  }
}
