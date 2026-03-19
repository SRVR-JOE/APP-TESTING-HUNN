import React, { useState, useMemo } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { NamingTemplate, LocationType } from '@shared/types';
import { LOCATION_TYPE_CONFIG } from '@shared/constants';
import { extractVariables, compileName, validateTemplate } from '../lib/naming-engine';
import { LocationTypeBadge } from './LocationTypeBadge';

interface Props {
  template?: NamingTemplate | null;
  onSave: (data: { name: string; pattern: string; locationType: LocationType; variables: Record<string, string> }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export const NamingTemplateEditor: React.FC<Props> = ({ template, onSave, onDelete, onClose }) => {
  const [name, setName] = useState(template?.name ?? '');
  const [pattern, setPattern] = useState(template?.pattern ?? '{location}-{type}-{number}');
  const [locationType, setLocationType] = useState<LocationType>(template?.locationType ?? 'rack');
  const [variables, setVariables] = useState<Record<string, string>>(
    template?.variables ?? { location: 'FOH', type: 'RACK', number: '01' }
  );

  const extractedVars = useMemo(() => extractVariables(pattern), [pattern]);
  const preview = useMemo(() => compileName(pattern, variables), [pattern, variables]);
  const validation = useMemo(() => validateTemplate({ name, pattern, variables }), [name, pattern, variables]);

  // Sync new vars from pattern
  const missing = extractedVars.filter((v) => !(v in variables));
  if (missing.length > 0) {
    const updated = { ...variables };
    for (const v of missing) updated[v] = v === 'number' ? '01' : '';
    setVariables(updated);
  }

  const isBuiltIn = template?.isBuiltIn ?? false;

  return (
    <div className="bg-gray-800/90 border border-gray-700 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">
          {template ? (isBuiltIn ? 'Template Details' : 'Edit Template') : 'New Template'}
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Template Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isBuiltIn}
          placeholder="e.g. FOH Rack"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gc-accent disabled:opacity-50"
        />
      </div>

      {/* Location Type */}
      <div>
        <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Location Type</label>
        <div className="flex gap-2">
          {(Object.keys(LOCATION_TYPE_CONFIG) as LocationType[]).map((lt) => (
            <button
              key={lt}
              onClick={() => !isBuiltIn && setLocationType(lt)}
              disabled={isBuiltIn}
              className={`px-2 py-1 rounded-md border transition-colors ${
                locationType === lt
                  ? 'border-gc-accent/50 bg-gc-accent/10'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-600'
              } ${isBuiltIn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <LocationTypeBadge type={lt} size="sm" />
            </button>
          ))}
        </div>
      </div>

      {/* Pattern */}
      <div>
        <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Pattern</label>
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          disabled={isBuiltIn}
          placeholder="e.g. FOH-{type}-{number}"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-gc-accent disabled:opacity-50"
        />
        <p className="text-[10px] text-gray-500 mt-1">
          Use {'{variable}'} for dynamic parts. {'{number}'} auto-increments.
        </p>
      </div>

      {/* Variable defaults */}
      {extractedVars.length > 0 && (
        <div>
          <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Variable Defaults</label>
          <div className="space-y-1.5">
            {extractedVars.map((v) => (
              <div key={v} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 font-mono min-w-[60px]">{`{${v}}`}</span>
                <input
                  type="text"
                  value={variables[v] ?? ''}
                  onChange={(e) => setVariables({ ...variables, [v]: e.target.value })}
                  disabled={isBuiltIn}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-gc-accent disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="bg-gc-accent/10 border border-gc-accent/20 rounded-lg px-4 py-3">
        <p className="text-[9px] text-gc-accent uppercase tracking-wider mb-1">Preview</p>
        <p className="text-lg font-bold text-white font-mono">{preview}</p>
      </div>

      {/* Validation errors */}
      {!validation.valid && (
        <div className="space-y-0.5">
          {validation.errors.map((err, i) => (
            <p key={i} className="text-[10px] text-red-400">{err}</p>
          ))}
        </div>
      )}

      {/* Actions */}
      {!isBuiltIn && (
        <div className="flex gap-2 justify-end pt-2 border-t border-gray-700">
          {onDelete && template && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
          <button
            onClick={() => validation.valid && onSave({ name, pattern, locationType, variables })}
            disabled={!validation.valid}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              validation.valid
                ? 'text-gc-accent bg-gc-accent/15 hover:bg-gc-accent/25 cursor-pointer'
                : 'text-gray-500 bg-gray-800 cursor-not-allowed'
            }`}
          >
            <Plus size={12} /> {template ? 'Update' : 'Create'}
          </button>
        </div>
      )}
    </div>
  );
};

export default NamingTemplateEditor;
