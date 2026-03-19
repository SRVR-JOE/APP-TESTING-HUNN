import { create } from 'zustand';
import type { WebhookConfig, APIKeyConfig, UserAccount, UserRole } from '@shared/types';

// ---- Store shape ------------------------------------------------------------

export interface APIState {
  webhooks: WebhookConfig[];
  apiKeys: APIKeyConfig[];
  users: UserAccount[];

  // Webhooks
  addWebhook: (webhook: WebhookConfig) => void;
  updateWebhook: (id: string, updates: Partial<WebhookConfig>) => void;
  deleteWebhook: (id: string) => void;
  testWebhook: (id: string) => void;

  // API Keys
  generateAPIKey: (key: APIKeyConfig) => void;
  revokeAPIKey: (id: string) => void;

  // Users
  addUser: (user: UserAccount) => void;
  updateUser: (id: string, updates: Partial<UserAccount>) => void;
  deleteUser: (id: string) => void;
  changeRole: (id: string, role: UserRole) => void;
}

// ---- Mock data --------------------------------------------------------------

const MOCK_WEBHOOKS: WebhookConfig[] = [
  {
    id: 'wh-1',
    name: 'Slack Notification',
    url: 'https://hooks.slack.com/services/T0XXXXX/B0XXXXX/xxxxxxxxxxxxxxxxxxxx',
    events: ['link-down', 'temperature', 'health'],
    enabled: true,
    secret: 'whsec_slack_abc123',
    lastTriggered: new Date(Date.now() - 300000).toISOString(),
    failCount: 0,
  },
  {
    id: 'wh-2',
    name: 'PagerDuty',
    url: 'https://events.pagerduty.com/v2/enqueue',
    events: ['link-down', 'poe', 'temperature', 'drift'],
    enabled: true,
    secret: 'whsec_pd_xyz789',
    lastTriggered: new Date(Date.now() - 60000).toISOString(),
    failCount: 2,
  },
];

const MOCK_API_KEYS: APIKeyConfig[] = [
  {
    id: 'ak-1',
    name: 'Production Monitoring',
    key: 'lmx_prod_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    permissions: ['read:switches', 'read:alerts', 'read:stats', 'write:alerts'],
    createdAt: '2025-11-01T10:00:00Z',
    expiresAt: '2026-11-01T10:00:00Z',
    lastUsed: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'ak-2',
    name: 'CI/CD Pipeline',
    key: 'lmx_ci_q9w8e7r6t5y4u3i2o1p0a9s8d7f6g5h4',
    permissions: ['read:switches', 'write:config', 'deploy'],
    createdAt: '2026-01-15T14:30:00Z',
    expiresAt: '2026-07-15T14:30:00Z',
    lastUsed: new Date(Date.now() - 86400000).toISOString(),
  },
];

const MOCK_USERS: UserAccount[] = [
  {
    id: 'usr-1',
    username: 'admin',
    displayName: 'System Admin',
    role: 'admin',
    departmentAccess: ['dante-primary', 'dante-secondary', 'aes67', 'sacn', 'artnet', 'ndi', 'st2110', 'ma-net', 'avb', 'comms', 'video', 'management', 'guest-wifi'],
    canDeploy: true,
    canModifyProfiles: true,
    canModifyShowFiles: true,
    lastLogin: new Date(Date.now() - 3600000).toISOString(),
    createdAt: '2025-06-01T08:00:00Z',
  },
  {
    id: 'usr-2',
    username: 'lighting_eng',
    displayName: 'Lighting Engineer',
    role: 'lighting',
    departmentAccess: ['sacn', 'artnet', 'ma-net'],
    canDeploy: false,
    canModifyProfiles: true,
    canModifyShowFiles: true,
    lastLogin: new Date(Date.now() - 7200000).toISOString(),
    createdAt: '2025-08-15T10:00:00Z',
  },
  {
    id: 'usr-3',
    username: 'audio_eng',
    displayName: 'Audio Engineer',
    role: 'audio',
    departmentAccess: ['dante-primary', 'dante-secondary', 'aes67', 'avb'],
    canDeploy: false,
    canModifyProfiles: true,
    canModifyShowFiles: true,
    lastLogin: new Date(Date.now() - 14400000).toISOString(),
    createdAt: '2025-09-01T09:00:00Z',
  },
  {
    id: 'usr-4',
    username: 'viewer',
    displayName: 'Guest Viewer',
    role: 'viewer',
    departmentAccess: [],
    canDeploy: false,
    canModifyProfiles: false,
    canModifyShowFiles: false,
    lastLogin: new Date(Date.now() - 86400000).toISOString(),
    createdAt: '2026-01-10T12:00:00Z',
  },
];

// ---- Store ------------------------------------------------------------------

export const useAPIStore = create<APIState>((set) => ({
  webhooks: MOCK_WEBHOOKS,
  apiKeys: MOCK_API_KEYS,
  users: MOCK_USERS,

  // ─── Webhooks ──────────────────────────────────────────────────────
  addWebhook: (webhook) =>
    set((state) => ({ webhooks: [...state.webhooks, webhook] })),

  updateWebhook: (id, updates) =>
    set((state) => ({
      webhooks: state.webhooks.map((w) =>
        w.id === id ? { ...w, ...updates } : w,
      ),
    })),

  deleteWebhook: (id) =>
    set((state) => ({
      webhooks: state.webhooks.filter((w) => w.id !== id),
    })),

  testWebhook: (id) =>
    set((state) => ({
      webhooks: state.webhooks.map((w) =>
        w.id === id
          ? { ...w, lastTriggered: new Date().toISOString(), failCount: 0 }
          : w,
      ),
    })),

  // ─── API Keys ──────────────────────────────────────────────────────
  generateAPIKey: (key) =>
    set((state) => ({ apiKeys: [...state.apiKeys, key] })),

  revokeAPIKey: (id) =>
    set((state) => ({
      apiKeys: state.apiKeys.filter((k) => k.id !== id),
    })),

  // ─── Users ─────────────────────────────────────────────────────────
  addUser: (user) =>
    set((state) => ({ users: [...state.users, user] })),

  updateUser: (id, updates) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === id ? { ...u, ...updates } : u,
      ),
    })),

  deleteUser: (id) =>
    set((state) => ({
      users: state.users.filter((u) => u.id !== id),
    })),

  changeRole: (id, role) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === id ? { ...u, role } : u,
      ),
    })),
}));
