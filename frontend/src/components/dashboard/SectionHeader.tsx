import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
}

const SectionHeader = ({ title, description, action }: Props) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
    <div>
      <h2 className="text-2xl font-bold text-[var(--color-neutral-100)] mb-1">{title}</h2>
      {description && (
        <p className="text-sm text-[var(--color-neutral-400)]">{description}</p>
      )}
    </div>
    {action && <div>{action}</div>}
  </div>
);

export default SectionHeader;
