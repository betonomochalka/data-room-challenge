import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Skeleton, SkeletonText, SkeletonCard, SkeletonTable } from '../../components/ui/Skeleton';

describe('Skeleton Component', () => {
  describe('Basic Skeleton', () => {
    it('renders with default props', () => {
      const { container } = render(<Skeleton />);
      const skeleton = container.firstChild as HTMLElement;
      
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('animate-pulse', 'rounded-md', 'bg-muted');
    });

    it('applies custom className', () => {
      const { container } = render(<Skeleton className="h-10 w-full" />);
      const skeleton = container.firstChild as HTMLElement;
      
      expect(skeleton).toHaveClass('h-10', 'w-full');
    });

    it('merges className properly', () => {
      const { container } = render(<Skeleton className="custom-class" />);
      const skeleton = container.firstChild as HTMLElement;
      
      expect(skeleton).toHaveClass('animate-pulse');
      expect(skeleton).toHaveClass('custom-class');
    });
  });

  describe('SkeletonText', () => {
    it('renders default 3 lines', () => {
      const { container } = render(<SkeletonText />);
      const lines = container.querySelectorAll('.animate-pulse');
      
      expect(lines).toHaveLength(3);
    });

    it('renders custom number of lines', () => {
      const { container } = render(<SkeletonText lines={5} />);
      const lines = container.querySelectorAll('.animate-pulse');
      
      expect(lines).toHaveLength(5);
    });

    it('last line is shorter', () => {
      const { container } = render(<SkeletonText lines={3} />);
      const lines = container.querySelectorAll('.animate-pulse');
      const lastLine = lines[lines.length - 1];
      
      expect(lastLine).toHaveClass('w-2/3');
    });

    it('non-last lines are full width', () => {
      const { container } = render(<SkeletonText lines={3} />);
      const lines = container.querySelectorAll('.animate-pulse');
      const firstLine = lines[0];
      
      expect(firstLine).toHaveClass('w-full');
    });
  });

  describe('SkeletonCard', () => {
    it('renders card structure', () => {
      const { container } = render(<SkeletonCard />);
      
      // Check for border and rounded corners
      const card = container.querySelector('.border.rounded-lg');
      expect(card).toBeInTheDocument();
    });

    it('renders avatar skeleton', () => {
      const { container } = render(<SkeletonCard />);
      
      // Check for rounded avatar
      const avatar = container.querySelector('.rounded-full');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveClass('h-12', 'w-12');
    });

    it('renders text skeletons', () => {
      const { container } = render(<SkeletonCard />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      
      // Should have multiple skeleton elements
      expect(skeletons.length).toBeGreaterThan(3);
    });
  });

  describe('SkeletonTable', () => {
    it('renders default 5 rows', () => {
      const { container } = render(<SkeletonTable />);
      const rows = container.querySelectorAll('.flex.items-center');
      
      expect(rows).toHaveLength(5);
    });

    it('renders custom number of rows', () => {
      const { container } = render(<SkeletonTable rows={10} />);
      const rows = container.querySelectorAll('.flex.items-center');
      
      expect(rows).toHaveLength(10);
    });

    it('each row has correct structure', () => {
      const { container } = render(<SkeletonTable rows={1} />);
      const row = container.querySelector('.flex.items-center');
      const skeletons = row?.querySelectorAll('.animate-pulse');
      
      // Each row should have 4 skeleton elements
      expect(skeletons).toHaveLength(4);
    });
  });

  describe('Accessibility', () => {
    it('skeletons render without errors', () => {
      const { container } = render(
        <div>
          <Skeleton />
          <SkeletonText lines={2} />
        </div>
      );
      
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('renders quickly with many skeletons', () => {
      const startTime = performance.now();
      render(<SkeletonTable rows={100} />);
      const endTime = performance.now();
      
      // Should render 100 rows in less than 100ms
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});

