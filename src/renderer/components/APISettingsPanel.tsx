import React, { useState, useCallback } from 'react';
import {
  Webhook,
  Key,
  Users,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Send,
  Shield,
  ShieldCheck,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAPIStore } from '../store/useAPIStore';
import { ROLE_PERMISSIONS } from '@shared/constants';
import type { WebhookConfig, APIKeyConfig, UserAccount, UserRole } from '@shared/types';

// ─── Sub-tab type ────────────────────────────────────────────────────────────

type SubTab = 'webhooks' | 'apikeys' | 'users';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskString(str: string, visibleChars = 8): string {
  if (str.length <= visibleChars) return str;
  return str.slice(0, visibleChars) + '••••••••';
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-500/20 text-red-300 border-red-500/30',
  'system-engineer': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  lighting: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  audio: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  video: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  viewer: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const WEBHOOK_EVENTS = [
  'link-down',
  'bandwidth',
  'temperature',
  'poe',
  'firmware',
  'drift',
  'health',
  'deploy',
  'config-change',
];

const API_PERMISSIONS = [
  'read:switches',
  'read:alerts',
  'read:stats',
  'write:alerts',
  'write:config',
  'deploy',
  'admin',
];

const ALL_DEPARTMENTS = [
  'dante-primary',
  'dante-secondary',
  'aes67',
  'sacn',
  'artnet',
  'ma-net',
  'ndi',
  'st2110',
  'avb',
  'comms',
  'video',
  'management',
  'guest-wifi',
] as const;

// ─── Main Component ──────────────────────────────────────────────────────────

export default function APISettingsPanel() {
  const {
    webhooks,
    apiKeys,
    users,
    addWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
    generateAPIKey,
    revokeAPIKey,
    addUser,
    updateUser,
    deleteUser,
    changeRole,
  } = useAPIStore();

  const [activeTab, setActiveTab] = useState<SubTab>('webhooks');

  // ─── Webhook state ───────────────────────────────────────────────
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whEvents, setWhEvents] = useState<string[]>([]);
  const [whSecret, setWhSecret] = useState('');
  const [testResult, setTestResult] = useState<Record<string, 'success' | 'fail' | null>>({});

  // ─── API Key state ───────────────────────────────────────────────
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyPerms, setKeyPerms] = useState<string[]>([]);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [revealedKeyId, setRevealedKeyId] = useState<string | null>(null);

  // ─── User state ──────────────────────────────────────────────────
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [uUsername, setUUsername] = useState('');
  const [uDisplayName, setUDisplayName] = useState('');
  const [uRole, setURole] = useState<UserRole>('viewer');
  const [uDepartments, setUDepartments] = useState<string[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // ─── Webhook handlers ────────────────────────────────────────────
  const resetWebhookForm = () => {
    setWhName('');
    setWhUrl('');
    setWhEvents([]);
    setWhSecret('');
    setEditingWebhookId(null);
    setShowWebhookForm(false);
  };

  const handleSaveWebhook = useCallback(() => {
    if (!whName.trim() || !whUrl.trim()) return;
    if (editingWebhookId) {
      updateWebhook(editingWebhookId, {
        name: whName.trim(),
        url: whUrl.trim(),
        events: whEvents,
        secret: whSecret.trim() || undefined,
      });
    } else {
      addWebhook({
        id: `wh-${Date.now()}`,
        name: whName.trim(),
        url: whUrl.trim(),
        events: whEvents,
        enabled: true,
        secret: whSecret.trim() || undefined,
        failCount: 0,
      });
    }
    resetWebhookForm();
  }, [whName, whUrl, whEvents, whSecret, editingWebhookId, addWebhook, updateWebhook]);

  const startEditWebhook = (wh: WebhookConfig) => {
    setEditingWebhookId(wh.id);
    setWhName(wh.name);
    setWhUrl(wh.url);
    setWhEvents(wh.events);
    setWhSecret(wh.secret || '');
    setShowWebhookForm(true);
  };

  const handleTestWebhook = useCallback((id: string) => {
    testWebhook(id);
    setTestResult((p) => ({ ...p, [id]: 'success' }));
    setTimeout(() => setTestResult((p) => ({ ...p, [id]: null })), 3000);
  }, [testWebhook]);

  // ─── API Key handlers ────────────────────────────────────────────
  const handleGenerateKey = useCallback(() => {
    if (!keyName.trim()) return;
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const randomKey = 'lmx_' + Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    generateAPIKey({
      id: `ak-${Date.now()}`,
      name: keyName.trim(),
      key: randomKey,
      permissions: keyPerms,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    });
    setKeyName('');
    setKeyPerms([]);
    setShowKeyForm(false);
  }, [keyName, keyPerms, generateAPIKey]);

  const handleCopyKey = useCallback((id: string, key: string) => {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  }, []);

  // ─── User handlers ───────────────────────────────────────────────
  const resetUserForm = () => {
    setUUsername('');
    setUDisplayName('');
    setURole('viewer');
    setUDepartments([]);
    setEditingUserId(null);
    setShowUserForm(false);
  };

  const handleSaveUser = useCallback(() => {
    if (!uUsername.trim() || !uDisplayName.trim()) return;
    const rolePerms = ROLE_PERMISSIONS.find((r) => r.role === uRole);
    if (editingUserId) {
      updateUser(editingUserId, {
        username: uUsername.trim(),
        displayName: uDisplayName.trim(),
        role: uRole,
        departmentAccess: uDepartments as any,
        canDeploy: rolePerms?.canDeploy ?? false,
        canModifyProfiles: rolePerms?.canModifyVlans ?? false,
        canModifyShowFiles: rolePerms?.canModifyVlans ?? false,
      });
    } else {
      addUser({
        id: `usr-${Date.now()}`,
        username: uUsername.trim(),
        displayName: uDisplayName.trim(),
        role: uRole,
        departmentAccess: uDepartments as any,
        canDeploy: rolePerms?.canDeploy ?? false,
        canModifyProfiles: rolePerms?.canModifyVlans ?? false,
        canModifyShowFiles: rolePerms?.canModifyVlans ?? false,
        createdAt: new Date().toISOString(),
      });
    }
    resetUserForm();
  }, [uUsername, uDisplayName, uRole, uDepartments, editingUserId, addUser, updateUser]);

  const startEditUser = (u: UserAccount) => {
    setEditingUserId(u.id);
    setUUsername(u.username);
    setUDisplayName(u.displayName);
    setURole(u.role);
    setUDepartments(u.departmentAccess as string[]);
    setShowUserForm(true);
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Shield size={22} className="text-gc-accent" />
        <div>
          <h2 className="text-lg font-bold">API & Integrations</h2>
          <p className="text-xs text-gray-400">Manage webhooks, API keys, and user access</p>
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-700 flex gap-0.5">
        {([
          { key: 'webhooks' as SubTab, label: 'Webhooks', icon: <Webhook size={14} />, count: webhooks.length },
          { key: 'apikeys' as SubTab, label: 'API Keys', icon: <Key size={14} />, count: apiKeys.length },
          { key: 'users' as SubTab, label: 'Users & Roles', icon: <Users size={14} />, count: users.length },
        ]).map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? 'border-gc-accent text-gc-accent'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
            <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ═════════════════════════════════════════════════════════════════
          WEBHOOKS TAB
         ═════════════════════════════════════════════════════════════════ */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Configured Webhooks</h3>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition"
              onClick={() => { resetWebhookForm(); setShowWebhookForm(true); }}
            >
              <Plus size={12} />
              Add Webhook
            </button>
          </div>

          {/* Webhook form */}
          {showWebhookForm && (
            <div className="bg-gray-800/50 border border-gc-accent/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-gc-accent">
                  {editingWebhookId ? 'Edit Webhook' : 'New Webhook'}
                </h4>
                <button className="text-gray-500 hover:text-white" onClick={resetWebhookForm}>
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-gc-accent"
                    placeholder="Slack Notification"
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">URL</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-gc-accent"
                    placeholder="https://hooks.example.com/..."
                    value={whUrl}
                    onChange={(e) => setWhUrl(e.target.value)}
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Secret (optional)</label>
                <input
                  className="w-full md:w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-gc-accent"
                  placeholder="whsec_..."
                  value={whSecret}
                  onChange={(e) => setWhSecret(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-2">Events</label>
                <div className="flex flex-wrap gap-2">
                  {WEBHOOK_EVENTS.map((evt) => (
                    <button
                      key={evt}
                      className={`px-2.5 py-1 rounded text-xs border transition ${
                        whEvents.includes(evt)
                          ? 'bg-gc-accent/10 border-gc-accent/30 text-gc-accent'
                          : 'bg-gray-800 border-gray-700 text-gray-400'
                      }`}
                      onClick={() =>
                        setWhEvents((prev) =>
                          prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt],
                        )
                      }
                    >
                      {evt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 text-sm rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition disabled:opacity-40"
                  disabled={!whName.trim() || !whUrl.trim()}
                  onClick={handleSaveWebhook}
                >
                  {editingWebhookId ? 'Update' : 'Create'} Webhook
                </button>
                <button
                  className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-300 hover:text-white transition"
                  onClick={resetWebhookForm}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Webhook list */}
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div key={wh.id} className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Webhook size={16} className="text-gc-accent" />
                  <span className="text-sm font-semibold">{wh.name}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    {/* Enabled toggle */}
                    <button
                      onClick={() => updateWebhook(wh.id, { enabled: !wh.enabled })}
                    >
                      <div className={`w-8 h-4 rounded-full transition-colors relative ${wh.enabled ? 'bg-gc-accent' : 'bg-gray-700'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${wh.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                    </button>
                    <button className="text-gray-500 hover:text-white" onClick={() => startEditWebhook(wh)}>
                      <Edit2 size={13} />
                    </button>
                    <button className="text-gray-500 hover:text-red-400" onClick={() => deleteWebhook(wh.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-400">
                  <div>
                    <span className="text-gray-500">URL: </span>
                    <span className="font-mono">{maskString(wh.url, 30)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Events: </span>
                    {wh.events.map((e) => (
                      <span key={e} className="inline-block bg-gray-700 px-1.5 py-0.5 rounded mr-1 text-[10px]">
                        {e}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    {wh.lastTriggered && (
                      <span><span className="text-gray-500">Last: </span>{timeAgo(wh.lastTriggered)}</span>
                    )}
                    {wh.failCount > 0 && (
                      <span className="text-red-400">
                        <AlertTriangle size={10} className="inline mr-0.5" />
                        {wh.failCount} fails
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition ${
                      testResult[wh.id] === 'success'
                        ? 'border-green-500/30 text-green-400'
                        : 'border-gray-600 text-gray-300 hover:border-gc-accent hover:text-gc-accent'
                    }`}
                    onClick={() => handleTestWebhook(wh.id)}
                  >
                    {testResult[wh.id] === 'success' ? (
                      <>
                        <Check size={12} />
                        Test Sent
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        Test Webhook
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          API KEYS TAB
         ═════════════════════════════════════════════════════════════════ */}
      {activeTab === 'apikeys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">API Keys</h3>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition"
              onClick={() => { setKeyName(''); setKeyPerms([]); setShowKeyForm(true); }}
            >
              <Plus size={12} />
              Generate Key
            </button>
          </div>

          {/* Key form */}
          {showKeyForm && (
            <div className="bg-gray-800/50 border border-gc-accent/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-gc-accent">Generate New API Key</h4>
                <button className="text-gray-500 hover:text-white" onClick={() => setShowKeyForm(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Key Name</label>
                <input
                  className="w-full md:w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-gc-accent"
                  placeholder="Production Monitoring"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-2">Permissions</label>
                <div className="flex flex-wrap gap-2">
                  {API_PERMISSIONS.map((perm) => (
                    <button
                      key={perm}
                      className={`px-2.5 py-1 rounded text-xs border transition ${
                        keyPerms.includes(perm)
                          ? 'bg-gc-accent/10 border-gc-accent/30 text-gc-accent'
                          : 'bg-gray-800 border-gray-700 text-gray-400'
                      }`}
                      onClick={() =>
                        setKeyPerms((prev) =>
                          prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
                        )
                      }
                    >
                      {perm}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 text-sm rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition disabled:opacity-40"
                  disabled={!keyName.trim()}
                  onClick={handleGenerateKey}
                >
                  Generate Key
                </button>
                <button
                  className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-300 hover:text-white transition"
                  onClick={() => setShowKeyForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Key list */}
          <div className="space-y-3">
            {apiKeys.map((ak) => (
              <div key={ak.id} className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Key size={16} className="text-gc-accent" />
                  <span className="text-sm font-semibold">{ak.name}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      className="text-gray-500 hover:text-red-400 text-xs flex items-center gap-1"
                      onClick={() => revokeAPIKey(ak.id)}
                    >
                      <Trash2 size={12} />
                      Revoke
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3 bg-gray-800 rounded-lg px-3 py-2">
                  <span className="text-xs font-mono text-gray-400 flex-1">
                    {revealedKeyId === ak.id ? ak.key : maskString(ak.key, 8)}
                  </span>
                  <button
                    className="text-gray-500 hover:text-white"
                    onClick={() => setRevealedKeyId(revealedKeyId === ak.id ? null : ak.id)}
                  >
                    {revealedKeyId === ak.id ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    className={`text-gray-500 hover:text-gc-accent transition ${copiedKeyId === ak.id ? 'text-green-400' : ''}`}
                    onClick={() => handleCopyKey(ak.id, ak.key)}
                  >
                    {copiedKeyId === ak.id ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-400">
                  <div>
                    <span className="text-gray-500">Permissions: </span>
                    {ak.permissions.map((p) => (
                      <span key={p} className="inline-block bg-gray-700 px-1.5 py-0.5 rounded mr-1 text-[10px]">
                        {p}
                      </span>
                    ))}
                  </div>
                  <div>
                    <span className="text-gray-500">Created: </span>
                    {new Date(ak.createdAt).toLocaleDateString()}
                    {ak.expiresAt && (
                      <span className="ml-2">
                        <span className="text-gray-500">Expires: </span>
                        {new Date(ak.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div>
                    {ak.lastUsed && (
                      <span>
                        <span className="text-gray-500">Last used: </span>
                        {timeAgo(ak.lastUsed)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          USERS & ROLES TAB
         ═════════════════════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Users & Roles</h3>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition"
              onClick={() => { resetUserForm(); setShowUserForm(true); }}
            >
              <Plus size={12} />
              Add User
            </button>
          </div>

          {/* Role descriptions */}
          <div className="bg-gray-800/20 border border-gray-700/50 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-1.5">
              <ShieldCheck size={12} />
              Role Reference
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {ROLE_PERMISSIONS.map((rp) => (
                <div key={rp.role} className={`border rounded-lg px-2.5 py-2 text-center ${ROLE_COLORS[rp.role]}`}>
                  <div className="text-[10px] font-bold">{rp.label}</div>
                  <div className="text-[9px] opacity-70 mt-0.5">{rp.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* User form */}
          {showUserForm && (
            <div className="bg-gray-800/50 border border-gc-accent/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-gc-accent">
                  {editingUserId ? 'Edit User' : 'New User'}
                </h4>
                <button className="text-gray-500 hover:text-white" onClick={resetUserForm}>
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Username</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-gc-accent"
                    placeholder="username"
                    value={uUsername}
                    onChange={(e) => setUUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Display Name</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-gc-accent"
                    placeholder="Full Name"
                    value={uDisplayName}
                    onChange={(e) => setUDisplayName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Role</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-gc-accent"
                    value={uRole}
                    onChange={(e) => setURole(e.target.value as UserRole)}
                  >
                    {ROLE_PERMISSIONS.map((rp) => (
                      <option key={rp.role} value={rp.role}>
                        {rp.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-2">Department Access</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DEPARTMENTS.map((dept) => (
                    <button
                      key={dept}
                      className={`px-2.5 py-1 rounded text-xs border transition ${
                        uDepartments.includes(dept)
                          ? 'bg-gc-accent/10 border-gc-accent/30 text-gc-accent'
                          : 'bg-gray-800 border-gray-700 text-gray-400'
                      }`}
                      onClick={() =>
                        setUDepartments((prev) =>
                          prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept],
                        )
                      }
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 text-sm rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition disabled:opacity-40"
                  disabled={!uUsername.trim() || !uDisplayName.trim()}
                  onClick={handleSaveUser}
                >
                  {editingUserId ? 'Update' : 'Create'} User
                </button>
                <button
                  className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-300 hover:text-white transition"
                  onClick={resetUserForm}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* User table */}
          <div className="overflow-hidden rounded-xl border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/50 text-gray-400 text-xs">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Department Access</th>
                  <th className="text-left px-4 py-3 font-medium">Permissions</th>
                  <th className="text-left px-4 py-3 font-medium">Last Login</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isExpanded = expandedUserId === user.id;
                  const rolePerms = ROLE_PERMISSIONS.find((r) => r.role === user.role);
                  return (
                    <React.Fragment key={user.id}>
                      <tr
                        className="border-t border-gray-800 hover:bg-gray-800/30 transition cursor-pointer"
                        onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{user.displayName}</div>
                          <div className="text-xs text-gray-500">@{user.username}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${ROLE_COLORS[user.role]}`}>
                            {rolePerms?.label || user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {user.departmentAccess.slice(0, 3).map((d) => (
                              <span key={d} className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded">
                                {d}
                              </span>
                            ))}
                            {user.departmentAccess.length > 3 && (
                              <span className="text-[10px] text-gray-500">+{user.departmentAccess.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 text-[10px]">
                            {user.canDeploy && <span className="bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded">Deploy</span>}
                            {user.canModifyProfiles && <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">Config</span>}
                            {user.canModifyShowFiles && <span className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">Shows</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {user.lastLogin ? timeAgo(user.lastLogin) : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button className="text-gray-500 hover:text-white" onClick={() => startEditUser(user)}>
                              <Edit2 size={13} />
                            </button>
                            <button className="text-gray-500 hover:text-red-400" onClick={() => deleteUser(user.id)}>
                              <Trash2 size={13} />
                            </button>
                            {isExpanded ? <ChevronUp size={13} className="text-gray-500" /> : <ChevronDown size={13} className="text-gray-500" />}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-gray-800/50">
                          <td colSpan={6} className="px-4 py-3 bg-gray-800/20">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
                              <div>
                                <span className="text-gray-500 block mb-1">Full Permissions:</span>
                                <div className="space-y-0.5">
                                  {rolePerms && (
                                    <>
                                      <div>Scan Network: {rolePerms.canScan ? 'Yes' : 'No'}</div>
                                      <div>Modify VLANs: {rolePerms.canModifyVlans ? 'Yes' : 'No'}</div>
                                      <div>Modify Ports: {rolePerms.canModifyPorts ? 'Yes' : 'No'}</div>
                                      <div>Deploy: {rolePerms.canDeploy ? 'Yes' : 'No'}</div>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-500 block mb-1">Management:</span>
                                <div className="space-y-0.5">
                                  {rolePerms && (
                                    <>
                                      <div>Manage Fleet: {rolePerms.canManageFleet ? 'Yes' : 'No'}</div>
                                      <div>Manage Tours: {rolePerms.canManageTours ? 'Yes' : 'No'}</div>
                                      <div>Manage Users: {rolePerms.canManageUsers ? 'Yes' : 'No'}</div>
                                      <div>Export: {rolePerms.canExport ? 'Yes' : 'No'}</div>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-500 block mb-1">Department Access:</span>
                                <div className="flex flex-wrap gap-1">
                                  {user.departmentAccess.map((d) => (
                                    <span key={d} className="bg-gray-700 px-1.5 py-0.5 rounded text-[10px]">
                                      {d}
                                    </span>
                                  ))}
                                  {user.departmentAccess.length === 0 && (
                                    <span className="text-gray-600">None</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-500 block mb-1">Account:</span>
                                <div>Created: {new Date(user.createdAt).toLocaleDateString()}</div>
                                <div>Dept Restricted: {rolePerms?.departmentRestriction ? 'Yes' : 'No'}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
