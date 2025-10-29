import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBackClick?: () => void;
  children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBackClick,
  children,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
      <div className="flex-1 flex items-center">
        {onBackClick && (
          <Button
            variant="ghost"
            onClick={onBackClick}
            className="mr-2 -ml-4"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {children && <div>{children}</div>}
    </div>
  );
};
