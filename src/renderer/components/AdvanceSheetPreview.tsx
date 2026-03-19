import React from 'react';
import {
  Network,
  Zap,
  Cable,
  Layers,
  Users,
  StickyNote,
  Printer,
  Copy,
  Download,
} from 'lucide-react';
import type { AdvanceSheet, AdvanceSheetSection } from '@shared/types';
import { formatAdvanceSheetText } from '../lib/advance-sheet-engine';

interface AdvanceSheetPreviewProps {
  sheet: AdvanceSheet;
  venueName?: string;
  tourName?: string;
  stopDate?: string;
}

const sectionIcons: Record<AdvanceSheetSection['type'], React.ElementType> = {
  'network-requirements': Network,
  'power-requirements': Zap,
  'cable-runs': Cable,
  'vlan-scheme': Layers,
  'contact-info': Users,
  notes: StickyNote,
};

const sectionColors: Record<AdvanceSheetSection['type'], string> = {
  'network-requirements': 'border-l-blue-500 bg-blue-500/5',
  'power-requirements': 'border-l-amber-500 bg-amber-500/5',
  'cable-runs': 'border-l-green-500 bg-green-500/5',
  'vlan-scheme': 'border-l-purple-500 bg-purple-500/5',
  'contact-info': 'border-l-cyan-500 bg-cyan-500/5',
  notes: 'border-l-gray-500 bg-gray-500/5',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdvanceSheetPreview: React.FC<AdvanceSheetPreviewProps> = ({
  sheet,
  venueName,
  tourName,
  stopDate,
}) => {
  const handleCopyText = () => {
    const text = formatAdvanceSheetText(sheet);
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: silent fail
    });
  };

  const handlePrint = () => {
    const text = formatAdvanceSheetText(sheet);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Advance Sheet${venueName ? ` - ${venueName}` : ''}</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 12px; padding: 40px; background: #fff; color: #000; }
              pre { white-space: pre-wrap; word-wrap: break-word; }
            </style>
          </head>
          <body><pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    const text = formatAdvanceSheetText(sheet);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advance-sheet-${venueName?.replace(/\s+/g, '-').toLowerCase() ?? sheet.tourStopId}-${sheet.generatedAt.split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gc-dark border border-gray-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gc-panel border-b border-gray-700/50 px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Advance Sheet</h2>
            {tourName && <p className="text-gc-blue text-sm font-medium mt-0.5">{tourName}</p>}
            <div className="flex items-center gap-3 mt-1">
              {venueName && <span className="text-gray-300 text-sm">{venueName}</span>}
              {stopDate && (
                <span className="text-gray-500 text-sm">
                  {new Date(stopDate + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
            <p className="text-gray-600 text-xs mt-2">Generated {formatDate(sheet.generatedAt)}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyText}
              className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              title="Copy to clipboard"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              title="Download as text"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              title="Print"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="p-5 space-y-4">
        {sheet.sections.map((section, idx) => {
          const Icon = sectionIcons[section.type] ?? StickyNote;
          const colorClass = sectionColors[section.type] ?? sectionColors.notes;

          return (
            <div
              key={idx}
              className={`border-l-4 rounded-r-lg p-4 ${colorClass}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-gray-300" />
                <h3 className="text-white font-semibold text-sm uppercase tracking-wider">
                  {section.title}
                </h3>
              </div>
              <pre className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                {section.content}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdvanceSheetPreview;
