import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, MoreVertical } from 'lucide-react';
import type { KPICardData } from './types';

interface Props {
  data: KPICardData;
  onClick?: () => void;
}

const colorMap: Record<KPICardData['color'], string> = {
  accent: 'from-[var(--color-accent)]/20 to-transparent border-[var(--color-accent)]/30 text-[var(--color-accent)]',
  success: 'from-[var(--color-success)]/20 to-transparent border-[var(--color-success)]/30 text-[var(--color-success)]',
  info: 'from-[var(--color-info)]/20 to-transparent border-[var(--color-info)]/30 text-[var(--color-info)]',
  warning: 'from-[var(--color-warning)]/20 to-transparent border-[var(--color-warning)]/30 text-[var(--color-warning)]',
};

const KPICardView = ({ data, onClick }: Props) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.03 }}
    whileTap={{ scale: 0.97 }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    className={`relative w-full h-full flex flex-col justify-between bg-gradient-to-br ${colorMap[data.color]} border rounded-2xl p-6 backdrop-blur-sm hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 cursor-pointer overflow-visible`}
  >
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-[var(--color-surface-overlay)]">{data.icon}</div>
      </div>
      <button
        className="p-2 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-200)] hover:bg-[var(--color-surface-overlay)] rounded-lg transition-colors duration-150"
        aria-label="More options"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>

    <p className="text-[var(--color-neutral-300)] text-base font-semibold mb-1">{data.label}</p>

    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-2xl font-bold text-[var(--color-neutral-100)]">{data.value}</h3>
    </div>

    {data.trend !== undefined && data.change !== undefined && (
      <div className="flex items-center gap-2 text-sm">
        {data.trend === 'up' ? (
          <>
            <ArrowUpRight className="w-4 h-4 text-[var(--color-success)]" />
            <span className="text-[var(--color-success)]">+{data.change}{data.changeUnit ?? '%'}</span>
          </>
        ) : (
          <>
            <ArrowDownRight className="w-4 h-4 text-[var(--color-danger)]" />
            <span className="text-[var(--color-danger)]">-{Math.abs(data.change)}{data.changeUnit ?? '%'}</span>
          </>
        )}
        <span className="text-[var(--color-neutral-500)]">{data.since ?? 'from last month'}</span>
      </div>
    )}
  </motion.button>
);

export default KPICardView;
