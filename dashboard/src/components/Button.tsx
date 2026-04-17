import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: ButtonVariant;
  icon?: string;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary font-bold rounded-lg shadow-md hover:opacity-90 active:scale-[0.98]',
  secondary:
    'bg-surface-container-highest text-on-surface font-semibold rounded-lg ghost-border hover:bg-surface-container-high active:scale-[0.98]',
  tertiary:
    'bg-transparent text-primary font-bold hover:underline underline-offset-4',
};

/**
 * Design System "Elemental Purity" — Button
 *
 * Variants:
 * - Primary: gradient primary, rounded-lg, text on-primary
 * - Secondary: surface + ghost border
 * - Tertiary: typographic with underline hover
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      icon,
      iconPosition = 'right',
      fullWidth = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const base = `inline-flex items-center justify-center gap-2 px-6 py-4 font-headline text-sm transition-all duration-200 ${
      fullWidth ? 'w-full' : ''
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${variantClasses[variant]} ${className}`;

    const iconEl = icon ? (
      <span className="material-symbols-outlined text-sm">{icon}</span>
    ) : null;

    return (
      <motion.button
        ref={ref}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        className={base}
        disabled={disabled}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {icon && iconPosition === 'left' && iconEl}
        {children}
        {icon && iconPosition === 'right' && iconEl}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
