import type { Role } from '../types';

interface Props {
  role: Role;
  skill: string;
  leadershipStyle: string;
  onRoleChange: (role: Role) => void;
  onSkillChange: (skill: string) => void;
  onStyleChange: (style: string) => void;
}

const ROLE_DATA: Record<Role, { skills: string[]; styles: string[] }> = {
  CFO: {
    skills: ['Financial Planning', 'Risk Management', 'Cost Optimization', 'M&A Strategy', 'Investor Relations'],
    styles: ['Analítico', 'Conservador', 'Innovador', 'Pragmático'],
  },
  CTO: {
    skills: ['Cloud Architecture', 'AI/ML Strategy', 'Cybersecurity', 'Digital Transformation', 'Tech Innovation'],
    styles: ['Visionario', 'Arquitecto', 'Disruptor', 'Pragmático'],
  },
  COO: {
    skills: ['Process Excellence', 'Supply Chain', 'Operations Strategy', 'Team Leadership', 'Performance KPIs'],
    styles: ['Ejecutor', 'Optimizador', 'Coach', 'Estratega'],
  },
  CEO: {
    skills: ['Strategic Vision', 'Stakeholder Management', 'Market Expansion', 'Culture Building', 'P&L Management'],
    styles: ['Visionario', 'Transformador', 'Coach', 'Estratega'],
  },
};

const ROLES: Role[] = ['CEO', 'CFO', 'CTO', 'COO'];

const ROLE_LABELS: Record<Role, string> = {
  CEO: '👑 CEO — Chief Executive Officer',
  CFO: '💰 CFO — Chief Financial Officer',
  CTO: '💻 CTO — Chief Technology Officer',
  COO: '⚙️ COO — Chief Operations Officer',
};

export default function RoleSelectors({ role, skill, leadershipStyle, onRoleChange, onSkillChange, onStyleChange }: Props) {
  const data = ROLE_DATA[role];

  const handleRoleChange = (newRole: Role) => {
    onRoleChange(newRole);
    onSkillChange(ROLE_DATA[newRole].skills[0]);
    onStyleChange(ROLE_DATA[newRole].styles[0]);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Selector 1: Rol */}
      <div className="flex flex-col gap-2">
        <label className="text-[#FFD700] text-xs font-semibold uppercase tracking-widest">
          Rol Ejecutivo
        </label>
        <div className="relative">
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as Role)}
            className="select-dark font-semibold pr-10"
          >
            {ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Selector 2: Habilidad */}
      <div className="flex flex-col gap-2">
        <label className="text-[#FFD700] text-xs font-semibold uppercase tracking-widest">
          Habilidad Principal
        </label>
        <div className="relative">
          <select
            value={skill}
            onChange={(e) => onSkillChange(e.target.value)}
            className="select-dark pr-10"
          >
            {data.skills.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Selector 3: Estilo de liderazgo */}
      <div className="flex flex-col gap-2">
        <label className="text-[#FFD700] text-xs font-semibold uppercase tracking-widest">
          Estilo de Liderazgo
        </label>
        <div className="relative">
          <select
            value={leadershipStyle}
            onChange={(e) => onStyleChange(e.target.value)}
            className="select-dark pr-10"
          >
            {data.styles.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
