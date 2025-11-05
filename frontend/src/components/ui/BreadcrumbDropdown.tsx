import React from 'react';
import { Home, MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { BreadcrumbItem } from './Breadcrumb';

interface BreadcrumbDropdownProps {
  hiddenItems: BreadcrumbItem[];
  allItems: BreadcrumbItem[];
}

export const BreadcrumbDropdown: React.FC<BreadcrumbDropdownProps> = ({
  hiddenItems,
  allItems,
}) => {
  if (hiddenItems.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-center h-6 w-6 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Show hidden folders"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {hiddenItems.map((hiddenItem, hiddenIndex) => {
          const itemIndex = allItems.findIndex(
            (item) =>
              item.path === hiddenItem.path &&
              (item.id === hiddenItem.id || (!item.id && !hiddenItem.id))
          );
          const isFirstItem = itemIndex === 0;

          return (
            <DropdownMenuItem
              key={hiddenItem.path || hiddenItem.id || hiddenIndex}
              asChild
            >
              <Link
                to={hiddenItem.path}
                className="flex items-center cursor-pointer"
              >
                {isFirstItem && <Home className="h-4 w-4 mr-2" />}
                {hiddenItem.name}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

