import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  id?: string;
  name: string;
  path: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav 
      aria-label="Breadcrumb" 
      className={`flex items-center space-x-1 text-sm text-muted-foreground ${className}`}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isFirst = index === 0;
        
        return (
          <React.Fragment key={item.path || index}>
            {index > 0 && (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )}
            {isLast ? (
              <span 
                className="font-medium text-foreground truncate max-w-[200px]" 
                title={item.name}
              >
                {isFirst && <Home className="h-4 w-4 inline-block mr-1" />}
                {item.name}
              </span>
            ) : (
              <Link
                to={item.path}
                className="hover:text-foreground transition-colors truncate max-w-[150px] flex items-center"
                title={item.name}
              >
                {isFirst && <Home className="h-4 w-4 inline-block mr-1" />}
                {item.name}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

