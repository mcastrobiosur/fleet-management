import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  /** Disable hover shadow animation */
  flat?: boolean;
  className?: string;
}

/**
 * Design System "Elemental Purity" — Card
 *
 * - bg surface-container-low, rounded-xl
 * - hover shadow-lg (ambient), no solid borders (only border-outline/5)
 * - Framer Motion entrance + hover transitions
 * - "No-Line" rule: surface color shifts instead of borders
 */
export default function Card({ children, flat = false, className = '', ...props }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={flat ? undefined : { boxShadow: '0 12px 50px rgba(29,27,23,0.1)' }}
      className={`bg-surface-container-low rounded-xl border border-outline/5 transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
