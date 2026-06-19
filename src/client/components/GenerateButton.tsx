import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

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
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      className={`relative w-full py-4 px-8 rounded-xl text-lg font-bold uppercase tracking-widest font-oswald
        transition-all duration-300 overflow-hidden
        ${disabled || loading
          ? 'bg-[#2a2a2a] border border-[#444] text-gray-500 cursor-not-allowed'
          : 'text-[#0d0d0d] cursor-pointer glow-gold glow-gold-hover'
        }`}
      style={disabled || loading ? {} : {
        background: 'linear-gradient(135deg, #B8860B 0%, #FFD700 35%, #FFF2AA 50%, #FFD700 65%, #B8860B 100%)',
      }}
    >
      {/* Shimmer effect on active state */}
      {!disabled && !loading && (
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)',
            backgroundSize: '200% 100%',
            animation: 'gold-text-shimmer 2.5s linear infinite',
          }}
        />
      )}

      <span className="relative flex items-center justify-center gap-3">
        {loading ? (
          <>
            <span className="text-2xl spin-ball inline-block">⚽</span>
            Generando tu cromo...
          </>
        ) : (
          <>
            <Sparkles size={20} />
            Generar Cromo
            <Sparkles size={20} />
          </>
        )}
      </span>
    </motion.button>
  );
}
