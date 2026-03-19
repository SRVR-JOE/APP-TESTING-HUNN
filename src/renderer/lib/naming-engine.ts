/**
 * Naming Engine — Pure logic for template compilation, conflict detection,
 * and pattern validation. No React dependencies.
 */

import type { NamingTemplate, DiscoveredSwitch } from '@shared/types';

const VARIABLE_RE = /\{(\w+)\}/g;

/** Extract variable names from a pattern like "FOH-{type}-{number}" */
export function extractVariables(pattern: string): string[] {
  const vars: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_RE.source, 'g');
  while ((match = re.exec(pattern)) !== null) {
    if (!vars.includes(match[1])) vars.push(match[1]);
  }
  return vars;
}

/** Compile a template pattern with variable values into a concrete name. */
export function compileName(pattern: string, variables: Record<string, string>): string {
  return pattern.replace(VARIABLE_RE, (_, key: string) => variables[key] ?? `{${key}}`);
}

/** Generate batch names with auto-incrementing {number}. */
export function generateBatchNames(
  pattern: string,
  baseVariables: Record<string, string>,
  count: number,
  startNumber = 1,
  numberPadding = 2,
): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const padded = String(startNumber + i).padStart(numberPadding, '0');
    names.push(compileName(pattern, { ...baseVariables, number: padded }));
  }
  return names;
}

export interface NamingConflict {
  name: string;
  existingSwitchId: string;
  existingSwitchName: string;
  newSwitchId: string;
}

/** Detect conflicts between proposed names and existing switches (case-insensitive). */
export function detectConflicts(
  proposed: { switchId: string; name: string }[],
  existingSwitches: DiscoveredSwitch[],
  excludeIds: string[] = [],
): NamingConflict[] {
  const conflicts: NamingConflict[] = [];
  const existingByName = new Map<string, DiscoveredSwitch>();
  for (const sw of existingSwitches) {
    if (!excludeIds.includes(sw.id)) existingByName.set(sw.name.toUpperCase(), sw);
  }
  const proposedByName = new Map<string, string>();

  for (const { switchId, name } of proposed) {
    const upper = name.toUpperCase();
    const existing = existingByName.get(upper);
    if (existing && existing.id !== switchId) {
      conflicts.push({ name, existingSwitchId: existing.id, existingSwitchName: existing.name, newSwitchId: switchId });
    }
    const prevId = proposedByName.get(upper);
    if (prevId && prevId !== switchId) {
      conflicts.push({ name, existingSwitchId: prevId, existingSwitchName: name, newSwitchId: switchId });
    }
    proposedByName.set(upper, switchId);
  }
  return conflicts;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePattern(pattern: string): ValidationResult {
  const errors: string[] = [];
  if (!pattern || pattern.trim().length === 0) return { valid: false, errors: ['Pattern cannot be empty'] };
  if (pattern.length > 64) errors.push('Pattern must be 64 characters or fewer');
  if ((pattern.match(/\{/g) || []).length !== (pattern.match(/\}/g) || []).length) errors.push('Unmatched braces');
  if (/\{\s*\}/.test(pattern)) errors.push('Variable names cannot be empty');
  if (/\{[^}]*[^a-zA-Z0-9_}][^}]*\}/.test(pattern)) errors.push('Variable names can only contain letters, numbers, underscores');
  const withoutVars = pattern.replace(VARIABLE_RE, 'X');
  if (/[^a-zA-Z0-9\-_. ]/.test(withoutVars)) errors.push('Pattern contains invalid characters');
  return { valid: errors.length === 0, errors };
}

export function validateTemplate(template: Pick<NamingTemplate, 'name' | 'pattern' | 'variables'>): ValidationResult {
  const errors: string[] = [];
  if (!template.name?.trim()) errors.push('Template name is required');
  errors.push(...validatePattern(template.pattern).errors);
  for (const v of extractVariables(template.pattern)) {
    if (!template.variables[v]) errors.push(`Variable "{${v}}" needs a default value`);
  }
  return { valid: errors.length === 0, errors };
}
