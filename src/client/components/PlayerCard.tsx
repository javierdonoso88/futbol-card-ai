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

// Color palette per role — teal/green background like Panini World Cup
const ROLE_COLORS: Record<Role, { bg: string; accent1: string; accent2: string; accent3: string }> = {
  CEO: { bg: '#1a7a6e', accent1: '#e63946', accent2: '#f4a261', accent3: '#2ec4b6' },
  CFO: { bg: '#1a5fa8', accent1: '#e63946', accent2: '#ffd166', accent3: '#06d6a0' },
  CTO: { bg: '#2d6a4f', accent1: '#f77f00', accent2: '#fcbf49', accent3: '#4cc9f0' },
  COO: { bg: '#6a0572', accent1: '#f72585', accent2: '#ffd166', accent3: '#4cc9f0' },
};

export default function PlayerCard({ result, role, uploadPreview, skill }: Props) {
  const { stats, playerName, imageBase64, mimeType, fallback } = result;
  const photoSrc = imageBase64
    ? `data:${mimeType};base64,${imageBase64}`
    : uploadPreview;

  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const colors = ROLE_COLORS[role];

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 3,
        backgroundColor: null,
        logging: false,
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `cromo-${role.toLowerCase()}-${playerName.toLowerCase().replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      >
        {/* ── PANINI CARD ── 240×340px, same ~1:1.42 ratio as real stickers */}
        <div
          ref={cardRef}
          style={{
            width: 240,
            height: 340,
            borderRadius: 12,
            overflow: 'hidden',
            position: 'relative',
            background: colors.bg,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1.5px rgba(255,255,255,0.15)',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {/* ── Background: large decorative number "25" like Panini ── */}
          <div style={{
            position: 'absolute',
            bottom: -10,
            right: -8,
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: 180,
            lineHeight: 1,
            color: 'rgba(255,255,255,0.07)',
            userSelect: 'none',
            pointerEvents: 'none',
          }}>
            AI
          </div>

          {/* ── Colorful blobs top-left (Panini style) ── */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 70, height: 70, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: -18, left: -18, width: 80, height: 80, borderRadius: '50%', background: colors.accent1, opacity: 0.9 }} />
            <div style={{ position: 'absolute', top: 10, left: -10, width: 55, height: 55, borderRadius: '50%', background: colors.accent2, opacity: 0.85 }} />
            <div style={{ position: 'absolute', top: -5, left: 20, width: 45, height: 45, borderRadius: '50%', background: colors.accent3, opacity: 0.8 }} />
          </div>

          {/* ── Colorful blobs bottom-right ── */}
          <div style={{ position: 'absolute', bottom: 44, right: 0, width: 60, height: 60, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', bottom: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: colors.accent2, opacity: 0.7 }} />
            <div style={{ position: 'absolute', bottom: 0, right: 5, width: 45, height: 45, borderRadius: '50%', background: colors.accent1, opacity: 0.65 }} />
          </div>

          {/* ── Top bar: FIFA-style icon + number ── */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 10px 0',
            zIndex: 10,
          }}>
            {/* Left: silhouette icon placeholder */}
            <div style={{
              width: 28, height: 28,
              borderRadius: 6,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" opacity={0.9}>
                <circle cx="12" cy="7" r="4"/><path d="M5.5 20a7 7 0 0 1 13 0"/>
              </svg>
            </div>

            {/* Right: "PANINI"-style badge + year number */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <div style={{
                background: 'rgba(255,255,255,0.92)',
                borderRadius: 4,
                padding: '1px 5px',
                fontSize: 7,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: colors.bg,
              }}>
                AI CARD
              </div>
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>2025</span>
            </div>
          </div>

          {/* ── Photo — fills most of the card ── */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            bottom: 88,
            overflow: 'hidden',
          }}>
            <img
              src={photoSrc}
              alt={playerName}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'top center',
              }}
            />
            {/* bottom fade into info area */}
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 60,
              background: `linear-gradient(to bottom, transparent, ${colors.bg})`,
            }} />
          </div>

          {/* ── Bottom info area ── */}
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: 96,
            background: colors.bg,
            display: 'flex',
            flexDirection: 'column',
            padding: '4px 8px 6px',
            zIndex: 5,
          }}>
            {/* Name + role row */}
            <div style={{ marginBottom: 3 }}>
              <div style={{
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                color: '#ffffff',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {playerName}
              </div>
              <div style={{
                fontSize: 7.5,
                color: 'rgba(255,255,255,0.65)',
                fontWeight: 600,
                letterSpacing: '0.08em',
                marginTop: 1,
              }}>
                {skill.toUpperCase()}
              </div>
            </div>

            {/* Separator */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', marginBottom: 4 }} />

            {/* Stats: 3 columns × 2 rows */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '3px 4px',
            }}>
              {[
                { v: stats.stat1, l: stats.label1 },
                { v: stats.stat2, l: stats.label2 },
                { v: stats.stat3, l: stats.label3 },
                { v: stats.stat4, l: stats.label4 },
                { v: stats.stat5, l: stats.label5 },
                { v: stats.stat6, l: stats.label6 },
              ].map(({ v, l }) => (
                <div key={l} style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 700,
                    fontSize: 11,
                    color: '#ffffff',
                    lineHeight: 1,
                  }}>
                    {v}
                  </span>
                  <span style={{
                    fontSize: 6,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.6)',
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                  }}>
                    {l}
                  </span>
                </div>
              ))}
            </div>

            {/* Role badge + overall */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 4,
            }}>
              <div style={{
                background: colors.accent1,
                borderRadius: 3,
                padding: '1px 5px',
                fontSize: 7,
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '0.1em',
              }}>
                {role}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  color: '#fff',
                  lineHeight: 1,
                }}>
                  {stats.overall}
                </span>
                <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>OVR</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Fallback notice */}
      {fallback && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-600/40 rounded-lg px-4 py-2 text-yellow-400 text-sm"
        >
          <span>⚠</span>
          <span>Preview — imagen IA no disponible. Usando foto original.</span>
        </motion.div>
      )}

      {/* Download button */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300
                   bg-[#0a1f12] border border-[#2a6b3a] text-[#FFD700]
                   hover:border-[#FFD700] hover:bg-[#0d2818] hover:shadow-[0_0_20px_rgba(255,215,0,0.2)]
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {downloading ? (
          <div className="w-4 h-4 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
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
