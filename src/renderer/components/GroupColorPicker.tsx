import React, { useState } from 'react';
import { Check } from 'lucide-react';

// ─── Preset Colors (Luminex group color palette) ────────────────────────────

export const PRESET_COLORS: { name: string; hex: string }[] = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Magenta', hex: '#EC4899' },
  { name: 'Pink', hex: '#F472B6' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Gray', hex: '#6B7280' },
];

interface GroupColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  showCustomInput?: boolean;
}

export const GroupColorPicker: React.FC<GroupColorPickerProps> = ({
  value,
  onChange,
  showCustomInput = true,
}) => {
  const [customHex, setCustomHex] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const isPreset = PRESET_COLORS.some((c) => c.hex === value);

  const handleCustomSubmit = () => {
    const hex = customHex.startsWith('#') ? customHex : `#${customHex}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex);
      setShowCustom(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-6 gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color.hex}
            type="button"
            title={color.name}
            onClick={() => onChange(color.hex)}
            className="w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all duration-150 hover:scale-110"
            style={{
              backgroundColor: color.hex,
              borderColor: value === color.hex ? '#FFFFFF' : 'transparent',
            }}
          >
            {value === color.hex && (
              <Check className="w-4 h-4 text-white drop-shadow-md" />
            )}
          </button>
        ))}
      </div>

      {showCustomInput && (
        <div className="mt-3">
          {!showCustom ? (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              {!isPreset && value ? (
                <span className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm inline-block"
                    style={{ backgroundColor: value }}
                  />
                  Custom: {value}
                </span>
              ) : (
                'Use custom hex...'
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                placeholder="#FF00AA"
                maxLength={7}
                className="w-24 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomSubmit();
                  if (e.key === 'Escape') setShowCustom(false);
                }}
              />
              <button
                type="button"
                onClick={handleCustomSubmit}
                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setShowCustom(false)}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupColorPicker;
