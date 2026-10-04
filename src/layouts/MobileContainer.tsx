import React from 'react';

export interface MobileContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const MobileContainer: React.FC<MobileContainerProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className="h-dvh max-h-dvh min-h-0 w-full bg-surface-ground flex justify-center text-content-primary overflow-hidden">
      <div className={`w-full max-w-md h-full max-h-dvh min-h-0 bg-surface-white flex flex-col shadow-sm border-x border-slate-200/60 relative overflow-hidden ${className}`}>
        {children}
      </div>
    </div>
  );
};
