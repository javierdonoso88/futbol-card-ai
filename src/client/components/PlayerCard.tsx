import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import type { GenerateResponse, Role } from '../types';

interface Props {
  result: GenerateResponse;
  role: Role;
  uploadPreview: string;
  skill: string;
}

interface StatItemProps {
  value: number;
  label: string;
}

function StatItem({ value, label }: StatItemProps) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className="font-oswald font-bold leading-none"
        style={{
          fontSize: '1.05rem',
          color: '#1a0900',
          textShadow: '0 1px 0 rgba(255,255,255,0.35)',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: '0.5rem',
          fontWeight: 700,
          color: '#2a1200',
          letterSpacing: '0.05em',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function PlayerCard({ result, role, uploadPreview }: Props) {
  const { stats, playerName, imageBase64, mimeType, fallback } = result;
  const photoSrc = imageBase64
    ? `data:${mimeType};base64,${imageBase64}`
    : uploadPreview;

  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // If AI generated the full card image, show it directly
  const isAIGeneratedCard = imageBase64 && imageBase64 !== result.stats.toString();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (isAIGeneratedCard) {
        // Download the AI image directly — no need for html2canvas
        const a = document.createElement('a');
        a.href = photoSrc;
        a.download = `cromo-${role.toLowerCase()}-${playerName.toLowerCase().replace(/\s+/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else if (cardRef.current) {
        const canvas = await html2canvas(cardRef.current, {
          useCORS: true, allowTaint: true, scale: 3, backgroundColor: null, logging: false,
        });
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `cromo-${role.toLowerCase()}-${playerName.toLowerCase().replace(/\s+/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } finally {
      setDownloading(false);
    }
  };

  // ── AI-generated full card: just show the image ──────────────────────────
  if (isAIGeneratedCard) {
    return (
      <div className="flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 20 }}
        >
          <img
            src={photoSrc}
            alt={`Cromo ${role} — ${playerName}`}
            style={{
              maxWidth: 360,
              width: '100%',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              display: 'block',
            }}
          />
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200
                     bg-[#004481] text-white hover:bg-[#003366] shadow-md hover:shadow-lg
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          )}
          {downloading ? 'Descargando...' : 'Descargar Cromo'}
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div
        initial={{ rotateY: 90, scale: 0.8, opacity: 0 }}
        animate={{ rotateY: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 20, duration: 0.7 }}
        style={{ perspective: 1000 }}
      >
        {/* Card container — fixed FIFA UT proportions */}
        <div
          ref={cardRef}
          className="relative rounded-xl overflow-hidden shadow-2xl"
          style={{
            width: 300,
            height: 420,
            boxShadow: '0 0 0 2px #B8860B, 0 0 0 4px #FFD70033, 0 20px 60px rgba(0,0,0,0.7), 0 0 80px rgba(255,215,0,0.2)',
          }}
        >
          {/* Layer 1: Gold gradient background */}
          <div className="absolute inset-0 card-bg" />

          {/* Layer 2: Diagonal texture */}
          <div className="absolute inset-0 card-texture" />

          {/* Layer 3: Shimmer overlay */}
          <div className="absolute inset-0 card-shimmer" />

          {/* Layer 4: Content */}
          <div className="absolute inset-0 flex flex-col">

            {/* Top bar: Rating + Role + Nation area */}
            <div className="flex items-start justify-between px-4 pt-3 pb-0">
              <div className="flex flex-col items-center leading-none">
                <span
                  className="font-oswald font-bold text-shadow-gold"
                  style={{ fontSize: '3.5rem', color: '#1a0900', lineHeight: 1 }}
                >
                  {stats.overall}
                </span>
                <span
                  className="font-oswald font-bold"
                  style={{ fontSize: '0.85rem', color: '#2a1200', letterSpacing: '0.08em', lineHeight: 1.2 }}
                >
                  {role}
                </span>
              </div>

              {/* Right side: decorative stars / club badge area */}
              <div className="flex flex-col items-center gap-1 mt-1">
                <div
                  className="text-xs font-bold opacity-60"
                  style={{ color: '#1a0900', fontSize: '0.6rem', letterSpacing: '0.1em' }}
                >
                  ★ ★ ★
                </div>
                <div
                  className="rounded border border-[#1a090066] px-1.5 py-0.5"
                  style={{ background: 'rgba(0,0,0,0.12)' }}
                >
                  <span style={{ fontSize: '0.45rem', fontWeight: 700, color: '#1a0900', letterSpacing: '0.08em' }}>
                    AI ELITE
                  </span>
                </div>
              </div>
            </div>

            {/* Photo area */}
            <div className="flex-1 relative mx-3 mt-1 mb-0 overflow-hidden rounded-t-lg">
              <img
                src={photoSrc}
                alt={playerName}
                className="w-full h-full object-cover object-top"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                }}
              />
            </div>

            {/* Player name banner */}
            <div
              className="mx-0 py-1.5 text-center"
              style={{ background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,215,0,0.3)' }}
            >
              <span
                className="font-oswald font-bold uppercase tracking-widest"
                style={{ fontSize: '0.85rem', color: '#1a0900', letterSpacing: '0.15em' }}
              >
                {playerName}
              </span>
            </div>

            {/* Stats grid: 2 columns × 3 rows */}
            <div
              className="grid grid-cols-2 px-4 py-2"
              style={{
                gap: '4px 16px',
                borderTop: '1px solid rgba(255,215,0,0.25)',
                background: 'rgba(0,0,0,0.08)',
              }}
            >
              <StatItem value={stats.stat1} label={stats.label1} />
              <StatItem value={stats.stat4} label={stats.label4} />
              <StatItem value={stats.stat2} label={stats.label2} />
              <StatItem value={stats.stat5} label={stats.label5} />
              <StatItem value={stats.stat3} label={stats.label3} />
              <StatItem value={stats.stat6} label={stats.label6} />
            </div>

            {/* Footer */}
            <div
              className="text-center py-1"
              style={{ borderTop: '1px solid rgba(255,215,0,0.2)' }}
            >
              <span
                style={{
                  fontSize: '0.4rem',
                  fontWeight: 700,
                  color: '#2a1200',
                  letterSpacing: '0.15em',
                  opacity: 0.6,
                }}
              >
                FÚTBOL CARD AI
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Fallback notice — hidden, kept for reference */}

      {/* Download button */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200
                   bg-[#004481] text-white hover:bg-[#003366] shadow-md hover:shadow-lg
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {downloading ? (
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        )}
        {downloading ? 'Generando PNG...' : 'Descargar Cromo'}
      </motion.button>
    </div>
  );
}
