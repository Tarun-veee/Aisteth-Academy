import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  icon,
  iconPosition = 'left',
  disabled,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 select-none';

  const sizeStyles = {
    sm: 'min-h-[40px] px-4 py-2 text-sm gap-1.5',
    md: 'min-h-[48px] px-5 py-2.5 text-base gap-2',
    lg: 'min-h-[54px] px-6 py-3.5 text-base sm:text-lg gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-brand-600 text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 active:bg-brand-800 border border-transparent',
    secondary:
      'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200 border border-brand-200',
    outline:
      'bg-white text-content-primary hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-200 hover:border-slate-300',
    success:
      'bg-status-success text-white shadow-md shadow-status-success/20 hover:bg-green-700 active:bg-green-800 border border-transparent',
    danger:
      'bg-status-error text-white shadow-md shadow-status-error/20 hover:bg-red-700 active:bg-red-800 border border-transparent',
    ghost:
      'bg-transparent text-content-secondary hover:bg-slate-100 active:bg-slate-200 border border-transparent',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </button>
  );
};
