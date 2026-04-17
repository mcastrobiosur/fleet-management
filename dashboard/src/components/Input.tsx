import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Material Symbols icon name shown on the left */
  icon?: string;
  label?: string;
}

/**
 * Design System "Elemental Purity" — Input
 *
 * - bg surface-container-highest
 * - border-bottom ghost (transparent → primary on focus)
 * - focus border-primary with 2px thickness
 * - Rounded top corners, flat bottom for the "integrated" feel
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, label, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="font-label text-xs uppercase tracking-wider text-on-surface-variant font-bold"
          >
            {label}
          </label>
        )}
        <div className="relative group">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline group-focus-within:text-primary transition-colors">
                {icon}
              </span>
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-lg py-4 ${
              icon ? 'pl-12' : 'pl-4'
            } pr-4 text-on-surface placeholder:text-outline transition-all duration-200 font-body`}
            {...props}
          />
        </div>
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
