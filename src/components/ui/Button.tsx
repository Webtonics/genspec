import type { ButtonHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg shadow-sm hover:bg-primary-hover',
  secondary: 'border border-line bg-surface text-ink shadow-sm hover:border-line-strong hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
  danger: 'text-muted hover:bg-red-50 hover:text-red-600 scada:hover:bg-red-500/10 scada:hover:text-red-400',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-3.5 text-sm',
  icon: 'size-8 shrink-0',
};

/** Button classes, also for styling a <Link> as a button. */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return cx(
    'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:pointer-events-none disabled:opacity-50',
    SIZES[size],
    VARIANTS[variant],
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button type="button" className={cx(buttonClass(variant, size), className)} {...props} />;
}

/** Square icon-only button. Always give it an aria-label. */
export function IconButton({ variant = 'ghost', className, ...props }: Omit<ButtonProps, 'size'>) {
  return <button type="button" className={cx(buttonClass(variant, 'icon'), className)} {...props} />;
}
