import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface EcoMetricChipProps {
  children: ReactNode;
  /** Material Symbols icon name */
  icon?: string;
  className?: string;
}

/**
 * Design System "Elemental Purity" — Eco-Metric Chip
 *
 * Signature component: pill-shaped container (rounded-full)
 * with secondary-container bg and on-secondary-container text.
 * Used for sustainability data and eco-quality metrics.
 */
export default function EcoMetricChip({ children, icon, className = '' }: EcoMetricChipProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary font-label text-xs font-bold tracking-wide ${className}`}
    >
      {icon && (
        <span className="material-symbols-outlined text-sm">{icon}</span>
      )}
      {children}
    </motion.span>
  );
}
