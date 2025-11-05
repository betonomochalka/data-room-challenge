import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BreadcrumbDropdown } from './BreadcrumbDropdown';

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
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const [hiddenItems, setHiddenItems] = useState<BreadcrumbItem[]>([]);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  const calculateVisibleItems = useCallback(() => {
    if (items.length === 0) {
      setVisibleItems([]);
      setNeedsCollapse(false);
      setHiddenItems([]);
      return;
    }
    
    if (!containerRef.current) {
      setVisibleItems(items.map((_, i) => i));
      setNeedsCollapse(false);
      setHiddenItems([]);
      return;
    }

    const containerWidth = containerRef.current.offsetWidth;
    const MIN_ITEM_WIDTH = 80; // Minimum width for each visible item
    const SEPARATOR_WIDTH = 16; // Width of ChevronRight separator
    const ELLIPSIS_WIDTH = 40; // Width of "..." button
    
    // If we have few items or enough space, show all
    if (items.length <= 2) {
      setVisibleItems(items.map((_, i) => i));
      setNeedsCollapse(false);
      setHiddenItems([]);
      return;
    }

    // Always keep first and last visible
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    const middleItems = items.slice(1, -1);

    // Estimate required width
    const firstItemWidth = MIN_ITEM_WIDTH + (firstItem.name.length > 10 ? 50 : 0);
    const lastItemWidth = MIN_ITEM_WIDTH + (lastItem.name.length > 10 ? 50 : 0);
    const separatorsWidth = (items.length - 1) * SEPARATOR_WIDTH;
    const baseWidth = firstItemWidth + lastItemWidth + separatorsWidth;

    // If we have enough space, show all
    if (baseWidth + middleItems.length * MIN_ITEM_WIDTH <= containerWidth) {
      setVisibleItems(items.map((_, i) => i));
      setNeedsCollapse(false);
      setHiddenItems([]);
      return;
    }

    // Need to collapse - calculate how many middle items can fit
    const availableWidth = containerWidth - baseWidth - ELLIPSIS_WIDTH;
    const maxMiddleItems = Math.max(0, Math.floor(availableWidth / (MIN_ITEM_WIDTH + SEPARATOR_WIDTH)));

    if (maxMiddleItems >= middleItems.length) {
      // Can show all items
      setVisibleItems(items.map((_, i) => i));
      setNeedsCollapse(false);
      setHiddenItems([]);
    } else {
      // Need to collapse middle items
      const visibleMiddleIndices: number[] = [];
      let currentWidth = 0;
      
      // Try to show as many middle items as possible from the start
      for (let i = 0; i < middleItems.length; i++) {
        const itemWidth = MIN_ITEM_WIDTH;
        if (currentWidth + itemWidth + SEPARATOR_WIDTH <= availableWidth) {
          visibleMiddleIndices.push(i + 1); // +1 because middle items start at index 1
          currentWidth += itemWidth + SEPARATOR_WIDTH;
        } else {
          break;
        }
      }

      // Also try from the end
      const visibleFromEnd: number[] = [];
      currentWidth = 0;
      for (let i = middleItems.length - 1; i >= 0; i--) {
        const itemWidth = MIN_ITEM_WIDTH;
        if (currentWidth + itemWidth + SEPARATOR_WIDTH <= availableWidth) {
          visibleFromEnd.unshift(i + 1);
          currentWidth += itemWidth + SEPARATOR_WIDTH;
        } else {
          break;
        }
      }

      // Use the approach that shows more items
      const finalVisibleMiddle = 
        visibleMiddleIndices.length >= visibleFromEnd.length 
          ? visibleMiddleIndices 
          : visibleFromEnd;

      const finalVisible = [0, ...finalVisibleMiddle, items.length - 1];
      const hidden = items.filter((_, i) => !finalVisible.includes(i));

      setVisibleItems(finalVisible);
      setHiddenItems(hidden);
      setNeedsCollapse(hidden.length > 0);
    }
  }, [items]);

  useEffect(() => {
    calculateVisibleItems();

    const resizeObserver = new ResizeObserver(() => {
      calculateVisibleItems();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateVisibleItems]);

  useEffect(() => {
    // Recalculate on window resize
    const handleResize = () => {
      calculateVisibleItems();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateVisibleItems]);

  if (items.length === 0) {
    return null;
  }

  const renderBreadcrumbItem = (item: BreadcrumbItem, index: number, showSeparator = true) => {
    const isLast = index === items.length - 1;
    const isFirst = index === 0;

    return (
      <React.Fragment key={item.path || index}>
        {showSeparator && index > 0 && (
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
            className="hover:text-primary transition-colors truncate max-w-[150px] flex items-center"
            title={item.name}
          >
            {isFirst && <Home className="h-4 w-4 inline-block mr-1" />}
            {item.name}
          </Link>
        )}
      </React.Fragment>
    );
  };

  // If no collapse needed, render normally
  if (!needsCollapse || hiddenItems.length === 0) {
    return (
      <nav 
        ref={containerRef}
        aria-label="Breadcrumb" 
        className={`flex items-center space-x-1 text-sm text-muted-foreground ${className}`}
      >
        {items.map((item, index) => renderBreadcrumbItem(item, index))}
      </nav>
    );
  }

  // Render with collapse
  // Filter out invalid indices to prevent undefined errors
  const validVisibleItems = visibleItems.filter(index => index >= 0 && index < items.length);
  
  // If no valid visible items, fall back to showing all items
  if (validVisibleItems.length === 0) {
    return (
      <nav 
        ref={containerRef}
        aria-label="Breadcrumb" 
        className={`flex items-center space-x-1 text-sm text-muted-foreground ${className}`}
      >
        {items.map((item, index) => renderBreadcrumbItem(item, index))}
      </nav>
    );
  }
  
  return (
    <nav 
      ref={containerRef}
      aria-label="Breadcrumb" 
      className={`flex items-center space-x-1 text-sm text-muted-foreground ${className}`}
    >
      {validVisibleItems.map((itemIndex, visibleIndex) => {
        const item = items[itemIndex];
        
        // Safety check - skip if item doesn't exist
        if (!item) {
          return null;
        }
        
        // Check if we need to show ellipsis before this item
        const prevVisibleItemIndex = visibleIndex > 0 ? validVisibleItems[visibleIndex - 1] : -1;
        const shouldShowEllipsis = prevVisibleItemIndex !== -1 && itemIndex - prevVisibleItemIndex > 1;

        // Get hidden items between previous visible and current
        const hiddenBetween = shouldShowEllipsis 
          ? items.slice(prevVisibleItemIndex + 1, itemIndex)
          : [];

        return (
          <React.Fragment key={item.path || itemIndex}>
            {shouldShowEllipsis && hiddenBetween.length > 0 && (
              <>
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
                <BreadcrumbDropdown hiddenItems={hiddenBetween} allItems={items} />
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              </>
            )}
            {renderBreadcrumbItem(item, itemIndex, !shouldShowEllipsis)}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

