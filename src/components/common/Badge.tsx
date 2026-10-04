import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'brand' | 'neutral' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'brand',
  size = 'md',
  icon,
  className = '',
}) => {
  const baseStyles = 'inline-flex items-center font-semibold rounded-full select-none';

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs sm:text-sm gap-1.5',
  };

  const variantStyles = {
    brand: 'bg-brand-50 text-brand-700 border border-brand-200/80',
    neutral: 'bg-slate-100 text-content-secondary border border-slate-200',
    success: 'bg-status-successBg text-status-success border border-status-successBorder',
    warning: 'bg-status-warningBg text-status-warning border border-status-warningBorder',
    error: 'bg-status-errorBg text-status-error border border-status-errorBorder',
    outline: 'bg-white text-content-secondary border border-slate-300',
  };

  return (
    <span className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
