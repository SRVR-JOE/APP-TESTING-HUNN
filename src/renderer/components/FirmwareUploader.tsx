import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  File,
  CheckCircle2,
  AlertTriangle,
  X,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import type { DiscoveredSwitch } from '@shared/types';

export interface FirmwareUploaderProps {
  switches: DiscoveredSwitch[];
  onPreview: (file: FirmwareFileInfo) => void;
  onApply: (file: FirmwareFileInfo, rebootAfter: boolean) => void;
  previewReviewed: boolean;
}

export interface FirmwareFileInfo {
  name: string;
  size: number;
  checksum: string;
  compatibleModels: string[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Mock checksum generation
function mockChecksum(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

// Mock model detection from firmware filename
function detectModels(name: string): string[] {
  const lower = name.toLowerCase();
  if (lower.includes('gc-30')) return ['GC-30i'];
  if (lower.includes('gc-16')) return ['GC-16t'];
  if (lower.includes('gc-14')) return ['GC-14R'];
  if (lower.includes('gc-10')) return ['GC-10i'];
  if (lower.includes('gc-12')) return ['GC-12t'];
  // Generic firmware — all models
  return ['GC-30i', 'GC-16t', 'GC-14R', 'GC-10i', 'GC-12t'];
}

export const FirmwareUploader: React.FC<FirmwareUploaderProps> = ({
  switches,
  onPreview,
  onApply,
  previewReviewed,
}) => {
  const [fileInfo, setFileInfo] = useState<FirmwareFileInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rebootAfter, setRebootAfter] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const incompatibleSwitches = useMemo(() => {
    if (!fileInfo) return [];
    return switches.filter((s) => !fileInfo.compatibleModels.includes(s.model));
  }, [fileInfo, switches]);

  const compatibleSwitches = useMemo(() => {
    if (!fileInfo) return switches;
    return switches.filter((s) => fileInfo.compatibleModels.includes(s.model));
  }, [fileInfo, switches]);

  const handleFile = (file: File) => {
    const info: FirmwareFileInfo = {
      name: file.name,
      size: file.size,
      checksum: mockChecksum(file.name + file.size),
      compatibleModels: detectModels(file.name),
    };
    setFileInfo(info);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearFile = () => {
    setFileInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-white">Firmware Update</h4>
        <p className="text-xs text-gray-400 mt-0.5">
          Upload firmware and push to all selected switches
        </p>
      </div>

      {/* Drop zone */}
      {!fileInfo ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-gc-accent bg-gc-accent/5'
              : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
          }`}
        >
          <Upload
            className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-gc-accent' : 'text-gray-500'}`}
          />
          <p className="text-sm text-gray-300">
            Drag and drop firmware file here, or{' '}
            <span className="text-gc-accent">browse</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">Supports .bin and .fw files</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".bin,.fw,.img"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      ) : (
        /* File info display */
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gc-accent/10 rounded-lg">
                <File className="w-6 h-6 text-gc-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{fileInfo.name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{formatBytes(fileInfo.size)}</span>
                  <span className="font-mono">SHA: {fileInfo.checksum}</span>
                </div>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="p-1 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Compatible models */}
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2">Compatible models:</p>
            <div className="flex flex-wrap gap-1.5">
              {fileInfo.compatibleModels.map((model) => (
                <span
                  key={model}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {model}
                </span>
              ))}
            </div>
          </div>

          {/* Incompatible warnings */}
          {incompatibleSwitches.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="flex items-center gap-2 text-xs text-yellow-400 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                {incompatibleSwitches.length} selected switch
                {incompatibleSwitches.length > 1 ? 'es' : ''} not compatible:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {incompatibleSwitches.map((sw) => (
                  <span
                    key={sw.id}
                    className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded"
                  >
                    {sw.name} ({sw.model})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Target switches summary */}
      {fileInfo && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-white">
              Target Switches ({compatibleSwitches.length})
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {compatibleSwitches.map((sw) => (
              <div
                key={sw.id}
                className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded border border-gray-700"
              >
                <span className="text-xs text-white">{sw.name}</span>
                <span className="text-[10px] text-gray-500 font-mono ml-auto">{sw.ip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reboot option */}
      {fileInfo && (
        <label className="flex items-center gap-3 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={rebootAfter}
            onChange={(e) => setRebootAfter(e.target.checked)}
            className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-gc-accent focus:ring-gc-accent focus:ring-offset-0"
          />
          <div>
            <span className="text-sm text-white flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
              Reboot switches after upload
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              Switches will be rebooted sequentially to apply the firmware
            </p>
          </div>
        </label>
      )}

      {/* Actions */}
      {fileInfo && (
        <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
          <button
            onClick={() => onPreview(fileInfo)}
            className="px-4 py-2 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Preview Changes
          </button>
          <button
            onClick={() => onApply(fileInfo, rebootAfter)}
            disabled={!previewReviewed || compatibleSwitches.length === 0}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              previewReviewed && compatibleSwitches.length > 0
                ? 'bg-gc-accent text-white hover:bg-gc-accent/80'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Upload to {compatibleSwitches.length} Switches
          </button>
          {!previewReviewed && (
            <span className="text-xs text-gray-500">Preview changes first</span>
          )}
        </div>
      )}
    </div>
  );
};

export default FirmwareUploader;
