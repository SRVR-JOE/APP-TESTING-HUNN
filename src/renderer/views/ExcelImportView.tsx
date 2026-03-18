import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

export default function ExcelImportView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileSpreadsheet size={24} className="text-gc-accent" />
        <h2 className="text-xl font-semibold">Excel Import</h2>
      </div>
      <p className="text-gray-400">
        Import switch configurations from Excel spreadsheets or generate templates for offline planning.
      </p>
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-8 text-center text-gray-500">
        Excel Import View - Spreadsheet import/export interface will be implemented here.
      </div>
    </div>
  );
}
