import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';

interface ExcelDropzoneProps {
  onFileSelected: (file: File) => void;
  acceptedTypes?: string[];
  isLoading?: boolean;
}

export const ExcelDropzone: React.FC<ExcelDropzoneProps> = ({
  onFileSelected,
  acceptedTypes = ['.xlsx', '.xls'],
  isLoading = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [rejectedFile, setRejectedFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAcceptedFile = useCallback(
    (file: File) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return acceptedTypes.includes(ext);
    },
    [acceptedTypes]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    setRejectedFile(null);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (isAcceptedFile(file)) {
        setRejectedFile(null);
        onFileSelected(file);
      } else {
        setRejectedFile(file.name);
      }
    },
    [isAcceptedFile, onFileSelected]
  );

  const handleClick = () => {
    if (!isLoading) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isAcceptedFile(file)) {
      setRejectedFile(null);
      onFileSelected(file);
    } else {
      setRejectedFile(file.name);
    }
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-xl p-12
        flex flex-col items-center justify-center gap-4
        cursor-pointer transition-all duration-200
        ${isLoading
          ? 'border-gray-600 bg-gray-800/50 cursor-wait'
          : isDragOver
            ? 'border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/10'
            : 'border-gray-600 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-800/50'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />

      {isLoading ? (
        <>
          <Loader2 size={48} className="text-blue-400 animate-spin" />
          <p className="text-gray-300 text-lg font-medium">Parsing spreadsheet...</p>
          <p className="text-gray-500 text-sm">Analyzing sheets and validating structure</p>
        </>
      ) : isDragOver ? (
        <>
          <FileSpreadsheet size={48} className="text-blue-400" />
          <p className="text-blue-300 text-lg font-medium">Drop to import</p>
        </>
      ) : (
        <>
          <Upload size={48} className="text-gray-500" />
          <p className="text-gray-300 text-lg font-medium">
            Drop .xlsx file here or click to browse
          </p>
          <p className="text-gray-500 text-sm">
            Supports Excel files ({acceptedTypes.join(', ')})
          </p>
        </>
      )}

      {rejectedFile && (
        <p className="text-red-400 text-sm mt-2">
          &quot;{rejectedFile}&quot; is not a supported file type. Please use {acceptedTypes.join(' or ')}.
        </p>
      )}
    </div>
  );
};

export default ExcelDropzone;
