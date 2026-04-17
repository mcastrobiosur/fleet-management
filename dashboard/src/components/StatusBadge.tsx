import { motion } from 'framer-motion';

type BadgeStatus = 'due-now' | 'compliant' | 'pending';

interface StatusBadgeProps {
  status: BadgeStatus;
  /** Override the default label for the status */
  label?: string;
  className?: string;
}

const statusConfig: Record<BadgeStatus, { bg: string; text: string; border: string; defaultLabel: string }> = {
  'due-now': {
    bg: 'bg-error/10',
    text: 'text-error',
    border: 'border-error/20',
    defaultLabel: 'Due Now',
  },
  compliant: {
    bg: 'bg-secondary/10',
    text: 'text-secondary',
    border: 'border-secondary/20',
    defaultLabel: 'Compliant',
  },
  pending: {
    bg: 'bg-[#ffddb9]',
    text: 'text-brand-dark',
    border: 'border-transparent',
    defaultLabel: 'Pending',
  },
};

/**
 * Design System "Elemental Purity" — Status Badge
 *
 * - "Due Now": error/10 bg, error text
 * - "Compliant": secondary/10 bg, secondary text
 * - "Pending": #ffddb9 bg, brand-dark text
 * - Pill-shaped with backdrop-blur, uppercase tracking
 * - Framer Motion fade-in for state changes
 */
export default function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {label ?? config.defaultLabel}
    </motion.span>
  );
}
