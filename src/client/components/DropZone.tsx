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
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const scale = Math.sqrt(MAX_BYTES / file.size);
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
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
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onClick={() => !isCompressing && inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      className={`relative w-full rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden
        ${isDragging
          ? 'border-[#004481] bg-[#004481]/5 shadow-[0_0_0_4px_rgba(0,68,129,0.1)]'
          : value
            ? 'border-[#004481]/30 bg-white'
            : 'border-[#CCCCCC] bg-gray-50 hover:border-[#004481]/50 hover:bg-[#004481]/3'
        }
        h-44`}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {value ? (
        <div className="flex h-full">
          <div className="relative w-36 flex-shrink-0">
            <img src={value.preview} alt="Preview" className="w-full h-full object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white" />
          </div>
          <div className="flex flex-col justify-center px-5 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-green-600 text-sm font-semibold">Imagen lista</span>
            </div>
            <p className="text-gray-500 text-xs mb-3">Haz clic para cambiar la imagen</p>
            <div className="flex items-center gap-1.5 text-[#004481]/60 text-xs">
              <ImageIcon size={12} />
              <span>Arrastra otra imagen para reemplazar</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200
            ${isDragging ? 'bg-[#004481] text-white' : 'bg-[#004481]/10 text-[#004481]'}`}>
            {isCompressing
              ? <div className="w-5 h-5 border-2 border-[#004481] border-t-transparent rounded-full animate-spin" />
              : <Upload size={22} />}
          </div>
          <div className="text-center">
            <p className="text-gray-800 font-semibold text-sm mb-0.5">
              {isCompressing ? 'Comprimiendo imagen...' : 'Arrastra tu foto aquí'}
            </p>
            <p className="text-gray-400 text-xs">o haz clic para explorar</p>
            <p className="text-[#004481]/50 text-xs mt-1.5">PNG, JPG, WEBP · Máx. 10MB</p>
          </div>
        </div>
      )}

      {isDragging && (
        <div className="absolute inset-0 bg-[#004481]/8 flex items-center justify-center pointer-events-none">
          <p className="text-[#004481] font-bold text-sm">Suelta la imagen</p>
        </div>
      )}
    </div>
  );
}
