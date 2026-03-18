// ============================================================================
// GigaCore Command — Authentication / Credential Manager
// In-memory credential storage per switch, with future keytar integration.
// ============================================================================

import axios from 'axios';

import {
  ApiError,
  ApiErrorCode,
  SwitchCredentials,
} from './api-types';

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = '';

export class AuthManager {
  private credentials: Map<string, SwitchCredentials> = new Map();
  private defaultCredentials = {
    username: DEFAULT_USERNAME,
    password: DEFAULT_PASSWORD,
  };

  // ---------------------------------------------------------------------------
  // Per-switch credentials
  // ---------------------------------------------------------------------------

  /**
   * Store credentials for a specific switch.
   * The switchId is typically the switch IP or a unique identifier.
   */
  setCredentials(switchId: string, username: string, password: string): void {
    this.credentials.set(switchId, { switchId, username, password });
  }

  /**
   * Retrieve stored credentials for a switch.
   * Returns undefined if no credentials have been stored.
   */
  getCredentials(switchId: string): SwitchCredentials | undefined {
    return this.credentials.get(switchId);
  }

  /**
   * Remove stored credentials for a switch.
   */
  removeCredentials(switchId: string): void {
    this.credentials.delete(switchId);
  }

  /**
   * Check whether credentials are stored for a given switch.
   */
  hasCredentials(switchId: string): boolean {
    return this.credentials.has(switchId);
  }

  // ---------------------------------------------------------------------------
  // Default credentials (used when no per-switch entry exists)
  // ---------------------------------------------------------------------------

  getDefaultCredentials(): { username: string; password: string } {
    return { ...this.defaultCredentials };
  }

  setDefaultCredentials(username: string, password: string): void {
    this.defaultCredentials = { username, password };
  }

  // ---------------------------------------------------------------------------
  // Resolve — returns per-switch creds if available, else defaults
  // ---------------------------------------------------------------------------

  resolveCredentials(switchId: string): { username: string; password: string } {
    const stored = this.credentials.get(switchId);
    if (stored) {
      return { username: stored.username, password: stored.password };
    }
    return this.getDefaultCredentials();
  }

  // ---------------------------------------------------------------------------
  // Test credentials against a live switch
  // ---------------------------------------------------------------------------

  /**
   * Attempt a lightweight authenticated request to verify credentials.
   * Tries Gen2 `/api/system` first, then falls back to a Gen1 probe.
   * Returns true if the switch responds with 200, false on 401/403.
   * Throws on network-level errors.
   */
  async testCredentials(
    ip: string,
    username: string,
    password: string,
  ): Promise<boolean> {
    const auth = { username, password };
    const timeout = 5000;

    // Try Gen2 endpoint first
    try {
      const res = await axios.get(`http://${ip}/api/system`, {
        auth,
        timeout,
        validateStatus: () => true, // don't throw on non-2xx
      });

      if (res.status === 200) return true;
      if (res.status === 401 || res.status === 403) return false;

      // If /api/system returned 404 this is probably Gen1 — fall through.
      if (res.status !== 404) {
        return false;
      }
    } catch (err: any) {
      // Network error — could be the switch is Gen1 or truly unreachable.
      // Only propagate if it's clearly a network issue (no response at all).
      if (!err.response) {
        // Try Gen1 before giving up.
      }
    }

    // Try Gen1 endpoint
    try {
      const res = await axios.get(`http://${ip}/command`, {
        params: { cmd: 'get_sysinfo' },
        auth,
        timeout,
        validateStatus: () => true,
      });

      if (res.status === 200) return true;
      if (res.status === 401 || res.status === 403) return false;

      return false;
    } catch (err: any) {
      if (!err.response) {
        throw new ApiError(
          `Cannot reach switch at ${ip}: ${err.message}`,
          ApiErrorCode.NETWORK_ERROR,
          ip,
        );
      }
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Return the number of stored credential entries. */
  get size(): number {
    return this.credentials.size;
  }

  /** Clear all stored credentials. */
  clearAll(): void {
    this.credentials.clear();
  }
}
