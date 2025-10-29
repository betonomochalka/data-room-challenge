import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';

interface DataRoomHeaderProps {
  title: string;
  subtitle: string;
  onBackClick: () => void;
  backButtonText: string;
  backButtonTextShort?: string;
}

/**
 * Header component for Data Room and Folder views
 * Shows title, subtitle, and back navigation button
 */
export const DataRoomHeader: React.FC<DataRoomHeaderProps> = ({
  title,
  subtitle,
  onBackClick,
  backButtonText,
  backButtonTextShort,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
      <Button 
        variant="outline"
        size="sm"
        onClick={onBackClick}
      >
        <ArrowLeft className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">{backButtonText}</span>
        <span className="sm:hidden">{backButtonTextShort || 'Back'}</span>
      </Button>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
};

