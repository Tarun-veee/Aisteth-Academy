import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'active' | 'success' | 'error';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  ...props
}) => {
  const baseStyles = 'rounded-2xl transition-all duration-150';

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
  };

  const variantStyles = {
    default: 'bg-surface-white border border-slate-200/80 shadow-soft',
    elevated: 'bg-surface-white border border-slate-100 shadow-card',
    bordered: 'bg-surface-white border-2 border-slate-200',
    active: 'bg-brand-50/70 border-2 border-brand-600 shadow-soft',
    success: 'bg-status-successBg border-2 border-status-success shadow-soft',
    error: 'bg-status-errorBg border-2 border-status-error shadow-soft',
  };

  const interactiveStyles = interactive
    ? 'cursor-pointer active:scale-[0.99] hover:border-brand-400 select-none'
    : '';

  return (
    <div
      className={`${baseStyles} ${paddingStyles[padding]} ${variantStyles[variant]} ${interactiveStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
