import React, { useState } from 'react';
import { Clock, Calendar } from 'lucide-react';

export interface TimeRangeValue {
  start: string;
  end: string;
}

export type TimeRangePreset = 'last-hour' | 'last-24h' | 'last-7d' | 'all';

export interface TimeRangePickerProps {
  value: TimeRangePreset | TimeRangeValue;
  onChange: (range: TimeRangePreset | TimeRangeValue) => void;
}

const presets: { key: TimeRangePreset; label: string }[] = [
  { key: 'last-hour', label: 'Last Hour' },
  { key: 'last-24h', label: 'Last 24h' },
  { key: 'last-7d', label: 'Last 7d' },
  { key: 'all', label: 'All' },
];

export default function TimeRangePicker({ value, onChange }: TimeRangePickerProps) {
  const [showCustom, setShowCustom] = useState(typeof value === 'object');
  const [customStart, setCustomStart] = useState(
    typeof value === 'object' ? value.start.slice(0, 16) : ''
  );
  const [customEnd, setCustomEnd] = useState(
    typeof value === 'object' ? value.end.slice(0, 16) : ''
  );

  const activePreset = typeof value === 'string' ? value : null;

  const handlePresetClick = (preset: TimeRangePreset) => {
    setShowCustom(false);
    onChange(preset);
  };

  const handleCustomToggle = () => {
    setShowCustom((prev) => !prev);
    if (!showCustom) {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
      const start = dayAgo.toISOString().slice(0, 16);
      const end = now.toISOString().slice(0, 16);
      setCustomStart(start);
      setCustomEnd(end);
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onChange({
        start: new Date(customStart).toISOString(),
        end: new Date(customEnd).toISOString(),
      });
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Clock size={14} className="text-gray-400 shrink-0" />
      <div className="flex rounded-md overflow-hidden border border-gray-600">
        {presets.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePresetClick(key)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              activePreset === key && !showCustom
                ? 'bg-gc-accent text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={handleCustomToggle}
          className={`px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
            showCustom
              ? 'bg-gc-accent text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Calendar size={12} />
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gc-accent"
          />
          <span className="text-gray-500 text-xs">to</span>
          <input
            type="datetime-local"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gc-accent"
          />
          <button
            onClick={handleCustomApply}
            className="px-2.5 py-1 text-xs font-medium bg-gc-blue text-white rounded hover:bg-blue-600 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
