import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DropZone from './components/DropZone';
import RoleSelectors from './components/RoleSelectors';
import GenerateButton from './components/GenerateButton';
import PlayerCard from './components/PlayerCard';
import type { Role, GenerateResponse, UploadState } from './types';

const ROLE_DATA_DEFAULTS: Record<Role, { skill: string; style: string }> = {
  CEO: { skill: 'Strategic Vision',   style: 'Visionario' },
  CFO: { skill: 'Financial Planning', style: 'Analítico'  },
  CTO: { skill: 'Cloud Architecture', style: 'Visionario' },
  COO: { skill: 'Process Excellence', style: 'Ejecutor'   },
};

type AppView = 'upload' | 'loading' | 'result';

export default function App() {
  const [view, setView]                       = useState<AppView>('upload');
  const [upload, setUpload]                   = useState<UploadState | null>(null);
  const [role, setRole]                       = useState<Role>('CEO');
  const [skill, setSkill]                     = useState(ROLE_DATA_DEFAULTS.CEO.skill);
  const [leadershipStyle, setLeadershipStyle] = useState(ROLE_DATA_DEFAULTS.CEO.style);
  const [result, setResult]                   = useState<GenerateResponse | null>(null);
  const [error, setError]                     = useState<string | null>(null);

  const handleRoleChange = (r: Role) => {
    setRole(r);
    setSkill(ROLE_DATA_DEFAULTS[r].skill);
    setLeadershipStyle(ROLE_DATA_DEFAULTS[r].style);
  };

  const handleGenerate = async () => {
    if (!upload) return;
    setView('loading');
    setError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: upload.imageBase64, mimeType: upload.mimeType, role, skill, leadershipStyle }),
      });
      const data = await res.json() as { error?: string } & GenerateResponse;
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setResult(data);
      setView('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
      setView('upload');
    }
  };

  const handleReset = () => { setView('upload'); setResult(null); setError(null); };
  const canGenerate = !!upload && !!skill && !!leadershipStyle;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9]">

      {/* ── BBVA Header ── */}
      <header className="bg-[#004481] shadow-md">
        <div className="max-w-5xl mx-auto px-6 py-0 flex items-center justify-between h-16">
          {/* BBVA Logo */}
          <div className="flex items-center gap-3">
            <svg width="72" height="28" viewBox="0 0 72 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="0" y="22" fontFamily="'Inter',sans-serif" fontWeight="800" fontSize="24" fill="white" letterSpacing="-1">BBVA</text>
            </svg>
            <div className="h-5 w-px bg-white/30" />
            <span className="text-white/90 text-sm font-medium tracking-wide">Executive Card AI</span>
          </div>
          {/* Powered by badge */}
          <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#5AC8FA] animate-pulse" />
            <span className="text-white/80 text-xs font-medium">Powered by SAP AI Core</span>
          </div>
        </div>
      </header>

      {/* ── Hero strip ── */}
      <div className="bg-[#004481]">
        <div className="max-w-5xl mx-auto px-6 pb-10 pt-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-white text-3xl sm:text-4xl font-bold leading-tight mb-2">
              Tu cromo ejecutivo, generado por IA
            </h1>
            <p className="text-white/70 text-base">
              Sube una foto, elige tu perfil y obtén tu tarjeta coleccionable en segundos.
            </p>
          </motion.div>
        </div>
        {/* Wave divider */}
        <svg viewBox="0 0 1440 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="block w-full -mb-px">
          <path d="M0 32 C360 0 1080 0 1440 32 L1440 32 L0 32Z" fill="#F4F6F9"/>
        </svg>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">

          {/* Loading */}
          {view === 'loading' && (
            <motion.div key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[50vh] gap-6"
            >
              <div className="w-16 h-16 rounded-full bg-[#004481]/10 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  className="text-3xl"
                >⚽</motion.div>
              </div>
              <div className="text-center">
                <p className="text-[#004481] font-bold text-xl mb-1">Generando tu cromo ejecutivo...</p>
                <p className="text-gray-500 text-sm">La IA está procesando tu imagen</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.div key={i} className="w-2 h-2 rounded-full bg-[#004481]"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Upload form */}
          {view === 'upload' && (
            <motion.div key="upload"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Left column: form */}
              <div className="lg:col-span-2 flex flex-col gap-5">

                {/* Error */}
                {error && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-start gap-2"
                  >
                    <span className="mt-0.5 text-red-500">⚠</span>
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Step 1 */}
                <div className="bbva-card p-6">
                  <StepLabel step={1} label="Sube tu foto" />
                  <div className="mt-4">
                    <DropZone value={upload} onChange={setUpload} />
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bbva-card p-6">
                  <StepLabel step={2} label="Configura tu perfil ejecutivo" />
                  <div className="mt-4">
                    <RoleSelectors
                      role={role} skill={skill} leadershipStyle={leadershipStyle}
                      onRoleChange={handleRoleChange}
                      onSkillChange={setSkill}
                      onStyleChange={setLeadershipStyle}
                    />
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bbva-card p-6">
                  <StepLabel step={3} label="Genera tu cromo" />
                  <div className="mt-4">
                    <GenerateButton onGenerate={handleGenerate} disabled={!canGenerate} loading={false} />
                    {!upload && (
                      <p className="text-center text-gray-400 text-xs mt-3">Sube una foto para activar el generador</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column: preview card */}
              <div className="flex flex-col gap-4">
                <div className="bbva-card p-6 flex flex-col items-center gap-4 sticky top-6">
                  <p className="text-[#004481] font-semibold text-sm w-full">Vista previa</p>
                  {/* Placeholder card */}
                  <div className="relative rounded-xl overflow-hidden"
                    style={{ width: 200, height: 280,
                      background: 'linear-gradient(160deg, #5C4409 0%, #C8960C 25%, #FFD700 50%, #C8960C 75%, #5C4409 100%)',
                      boxShadow: '0 0 0 2px #B8860B, 0 8px 32px rgba(0,0,0,0.15)'
                    }}
                  >
                    <div className="absolute inset-0 card-texture" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-40">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="#1a0900">
                        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                      </svg>
                      <span className="text-[#1a0900] text-xs font-bold font-oswald uppercase tracking-widest">Tu foto aquí</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-xs">El cromo aparecerá aquí una vez generado</p>
                  </div>
                </div>

                {/* Info box */}
                <div className="bbva-card p-4 bg-[#004481]/5 border-[#004481]/15">
                  <p className="text-[#004481] text-xs font-semibold mb-2 uppercase tracking-wide">¿Cómo funciona?</p>
                  <ol className="text-gray-600 text-xs space-y-1.5">
                    <li className="flex gap-2"><span className="text-[#004481] font-bold">1.</span>Sube una foto tuya</li>
                    <li className="flex gap-2"><span className="text-[#004481] font-bold">2.</span>Selecciona tu rol ejecutivo</li>
                    <li className="flex gap-2"><span className="text-[#004481] font-bold">3.</span>La IA genera tu cromo único</li>
                    <li className="flex gap-2"><span className="text-[#004481] font-bold">4.</span>Descárgalo y compártelo</li>
                  </ol>
                </div>
              </div>
            </motion.div>
          )}

          {/* Result */}
          {view === 'result' && result && (
            <motion.div key="result"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8"
            >
              <div className="text-center">
                <p className="text-[#004481] font-bold text-2xl mb-1">¡Tu cromo ejecutivo está listo!</p>
                <p className="text-gray-500 text-sm">{role} · {skill} · {leadershipStyle}</p>
              </div>

              <PlayerCard result={result} role={role} skill={skill} uploadPreview={upload?.preview ?? ''} />

              <button onClick={handleReset}
                className="px-6 py-2.5 rounded-lg text-sm font-medium border border-[#004481] text-[#004481]
                           hover:bg-[#004481] hover:text-white transition-all duration-200"
              >
                ← Crear otro cromo
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#E8EDF2] bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-gray-400 text-xs">© 2025 BBVA · Executive Card AI Demo</span>
          <span className="text-gray-400 text-xs">Powered by SAP AI Core · Gemini</span>
        </div>
      </footer>
    </div>
  );
}

function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full bg-[#004481] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {step}
      </div>
      <span className="text-[#004481] font-semibold text-sm">{label}</span>
    </div>
  );
}
