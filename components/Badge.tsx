
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'red' | 'yellow' | 'gray';
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'gray' }) => {
  const styles = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    red: 'bg-rose-100 text-rose-700 border-rose-200',
    yellow: 'bg-amber-100 text-amber-700 border-amber-200',
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-semibold border rounded-full ${styles[variant]}`}>
      {children}
    </span>
  );
};

export default Badge;
