import { useState, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import type { UploadState } from '../types';

interface Props {
  value: UploadState | null;
  onChange: (state: UploadState) => void;
}

async function compressIfNeeded(file: File): Promise<{ base64: string; mimeType: string }> {
  const MAX_BYTES = 3 * 1024 * 1024;

  if (file.size <= MAX_BYTES) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target!.result as string;
        const [header, base64] = dataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
        resolve({ base64, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Compress via canvas
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const scale = Math.sqrt(MAX_BYTES / file.size);
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const [, base64] = dataUrl.split(',');
      resolve({ base64, mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function DropZone({ value, onChange }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsCompressing(true);
    try {
      const { base64, mimeType } = await compressIfNeeded(file);
      const preview = `data:${mimeType};base64,${base64}`;
      onChange({ imageBase64: base64, mimeType, preview });
    } finally {
      setIsCompressing(false);
    }
  }, [onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  return (
    <div
      onClick={() => !isCompressing && inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`relative w-full rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
        ${isDragging
          ? 'border-[#FFD700] bg-[#1a3d22] shadow-[0_0_30px_rgba(255,215,0,0.3)]'
          : 'border-[#2a6b3a] bg-[#0a1f12] hover:border-[#4a9a5a] hover:bg-[#0d2818]'
        }
        ${value ? 'h-52' : 'h-52'}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {value ? (
        // Preview state
        <div className="flex h-full">
          <div className="relative w-44 flex-shrink-0">
            <img
              src={value.preview}
              alt="Preview"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a1f12]" />
          </div>
          <div className="flex flex-col justify-center px-6 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-sm font-medium">Imagen lista</span>
            </div>
            <p className="text-gray-300 text-sm mb-4">Haz clic para cambiar la imagen</p>
            <div className="flex items-center gap-2 text-[#4a9a5a] text-xs">
              <ImageIcon size={14} />
              <span>Arrastra otra imagen para reemplazar</span>
            </div>
          </div>
        </div>
      ) : (
        // Empty state
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
            ${isDragging ? 'bg-[#FFD700] text-[#0d0d0d]' : 'bg-[#1a3d22] text-[#FFD700]'}`}
          >
            {isCompressing ? (
              <div className="w-6 h-6 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload size={28} />
            )}
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg mb-1">
              {isCompressing ? 'Comprimiendo imagen...' : 'Sube tu foto aquí'}
            </p>
            <p className="text-gray-400 text-sm">
              Arrastra y suelta o haz clic para explorar
            </p>
            <p className="text-[#4a9a5a] text-xs mt-2">PNG, JPG, WEBP · Máx. 10MB</p>
          </div>
        </div>
      )}

      {isDragging && (
        <div className="absolute inset-0 bg-[#FFD700]/10 flex items-center justify-center pointer-events-none">
          <p className="text-[#FFD700] font-bold text-xl font-oswald uppercase tracking-widest">
            Suelta la imagen
          </p>
        </div>
      )}
    </div>
  );
}
