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
  CEO: 'CEO — Chief Executive Officer',
  CFO: 'CFO — Chief Financial Officer',
  CTO: 'CTO — Chief Technology Officer',
  COO: 'COO — Chief Operations Officer',
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
      <div className="flex flex-col gap-1.5">
        <label className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Rol Ejecutivo</label>
        <select value={role} onChange={(e) => handleRoleChange(e.target.value as Role)} className="select-bbva">
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Habilidad Principal</label>
        <select value={skill} onChange={(e) => onSkillChange(e.target.value)} className="select-bbva">
          {data.skills.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Estilo de Liderazgo</label>
        <select value={leadershipStyle} onChange={(e) => onStyleChange(e.target.value)} className="select-bbva">
          {data.styles.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}
