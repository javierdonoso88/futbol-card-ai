import { motion } from 'framer-motion';

interface Props {
  onGenerate: () => void;
  disabled: boolean;
  loading: boolean;
}

export default function GenerateButton({ onGenerate, disabled, loading }: Props) {
  return (
    <motion.button
      onClick={onGenerate}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.01 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.99 } : {}}
      className={`relative w-full py-3.5 px-8 rounded-lg text-sm font-semibold
        transition-all duration-200 overflow-hidden
        ${disabled || loading
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
          : 'bg-[#004481] text-white hover:bg-[#003366] shadow-md hover:shadow-lg cursor-pointer'
        }`}
    >
      <span className="flex items-center justify-center gap-2">
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Generando cromo...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Generar Cromo Ejecutivo
          </>
        )}
      </span>
    </motion.button>
  );
}
