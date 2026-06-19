import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DropZone from './components/DropZone';
import RoleSelectors from './components/RoleSelectors';
import GenerateButton from './components/GenerateButton';
import PlayerCard from './components/PlayerCard';
import type { Role, GenerateResponse, UploadState } from './types';

const ROLE_DATA_DEFAULTS: Record<Role, { skill: string; style: string }> = {
  CEO: { skill: 'Strategic Vision', style: 'Visionario' },
  CFO: { skill: 'Financial Planning', style: 'Analítico' },
  CTO: { skill: 'Cloud Architecture', style: 'Visionario' },
  COO: { skill: 'Process Excellence', style: 'Ejecutor' },
};

type AppView = 'upload' | 'loading' | 'result';

export default function App() {
  const [view, setView] = useState<AppView>('upload');
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [role, setRole] = useState<Role>('CEO');
  const [skill, setSkill] = useState(ROLE_DATA_DEFAULTS.CEO.skill);
  const [leadershipStyle, setLeadershipStyle] = useState(ROLE_DATA_DEFAULTS.CEO.style);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({
          imageBase64: upload.imageBase64,
          mimeType: upload.mimeType,
          role,
          skill,
          leadershipStyle,
        }),
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

  const handleReset = () => {
    setView('upload');
    setResult(null);
    setError(null);
  };

  const canGenerate = !!upload && !!skill && !!leadershipStyle;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="py-6 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="font-oswald text-4xl sm:text-5xl font-bold uppercase tracking-widest gold-shimmer-text">
            Fútbol Card AI
          </h1>
          <p className="text-[#4a9a5a] text-sm mt-2 tracking-widest uppercase">
            Convierte tu foto en un cromo de élite
          </p>
        </motion.div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-12">
        <AnimatePresence mode="wait">

          {/* Loading screen */}
          {view === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center flex-1 gap-6 min-h-[50vh]"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="text-6xl"
              >
                ⚽
              </motion.div>
              <div className="text-center">
                <p className="text-[#FFD700] font-oswald text-2xl tracking-widest uppercase mb-2">
                  Generando tu cromo...
                </p>
                <p className="text-[#4a9a5a] text-sm">
                  La IA está transformando tu foto en un cromo de élite
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-[#FFD700]"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Upload form */}
          {view === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-2xl flex flex-col gap-6"
            >
              {/* Error banner */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-900/30 border border-red-600/40 rounded-xl px-4 py-3 text-red-400 text-sm flex items-start gap-2"
                >
                  <span className="mt-0.5">⚠</span>
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Step 1: Drop zone */}
              <div className="flex flex-col gap-3">
                <SectionLabel step={1} label="Sube tu foto" />
                <DropZone value={upload} onChange={setUpload} />
              </div>

              {/* Step 2: Selectors */}
              <div className="flex flex-col gap-3">
                <SectionLabel step={2} label="Configura tu perfil ejecutivo" />
                <RoleSelectors
                  role={role}
                  skill={skill}
                  leadershipStyle={leadershipStyle}
                  onRoleChange={handleRoleChange}
                  onSkillChange={setSkill}
                  onStyleChange={setLeadershipStyle}
                />
              </div>

              {/* Step 3: Generate */}
              <div className="flex flex-col gap-3">
                <SectionLabel step={3} label="Genera tu cromo" />
                <GenerateButton
                  onGenerate={handleGenerate}
                  disabled={!canGenerate}
                  loading={view === 'loading'}
                />
                {!upload && (
                  <p className="text-center text-[#4a9a5a] text-xs">
                    Sube una foto para activar el generador
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Result */}
          {view === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8"
            >
              {/* Card info */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <p className="text-[#FFD700] font-oswald text-xl tracking-widest uppercase">
                  ¡Tu cromo está listo!
                </p>
                <p className="text-[#4a9a5a] text-sm mt-1">
                  {role} · {skill} · {leadershipStyle}
                </p>
              </motion.div>

              <PlayerCard
                result={result}
                role={role}
                uploadPreview={upload?.preview ?? ''}
              />

              {/* New card button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={handleReset}
                className="px-8 py-3 rounded-xl font-semibold text-sm border border-[#2a6b3a] text-[#4a9a5a]
                           hover:border-[#FFD700] hover:text-[#FFD700] transition-all duration-300"
              >
                ← Crear otro cromo
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <footer className="text-center py-4 text-[#1a4731] text-xs">
        Powered by SAP AI Core · Gemini
      </footer>
    </div>
  );
}

function SectionLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full bg-[#FFD700] flex items-center justify-center text-[#0d0d0d] text-xs font-bold font-oswald flex-shrink-0">
        {step}
      </div>
      <span className="text-white font-semibold text-sm uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-[#1a3d22]" />
    </div>
  );
}
