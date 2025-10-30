import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem } from '../../components/ui/Breadcrumb';

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Breadcrumb Component', () => {
  const mockItems: BreadcrumbItem[] = [
    { id: 'room-1', name: 'My Data Room', path: '/data-rooms/room-1' },
    { id: 'folder-1', name: 'Documents', path: '/data-rooms/room-1/folders/folder-1' },
    { id: 'folder-2', name: 'Reports', path: '/data-rooms/room-1/folders/folder-2' },
  ];

  it('renders nothing when items array is empty', () => {
    const { container } = renderWithRouter(<Breadcrumb items={[]} />);
    expect(container.querySelector('nav')).not.toBeInTheDocument();
  });

  it('renders all breadcrumb items', () => {
    renderWithRouter(<Breadcrumb items={mockItems} />);
    
    expect(screen.getByText('My Data Room')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('renders navigation with proper structure', () => {
    const { container } = renderWithRouter(<Breadcrumb items={mockItems} />);
    
    // Check that nav element is present with proper aria-label
    const nav = container.querySelector('nav[aria-label="Breadcrumb"]');
    expect(nav).toBeInTheDocument();
  });

  it('renders proper number of items with separators', () => {
    renderWithRouter(<Breadcrumb items={mockItems} />);
    
    // Verify all items are present
    expect(screen.getByText('My Data Room')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('renders all items except the last as links', () => {
    renderWithRouter(<Breadcrumb items={mockItems} />);
    
    const firstItem = screen.getByText('My Data Room');
    const secondItem = screen.getByText('Documents');
    const lastItem = screen.getByText('Reports');
    
    // First and second should be links
    expect(firstItem.closest('a')).toBeInTheDocument();
    expect(firstItem.closest('a')).toHaveAttribute('href', '/data-rooms/room-1');
    
    expect(secondItem.closest('a')).toBeInTheDocument();
    expect(secondItem.closest('a')).toHaveAttribute('href', '/data-rooms/room-1/folders/folder-1');
    
    // Last item should NOT be a link
    expect(lastItem.closest('a')).not.toBeInTheDocument();
  });

  it('renders the last item as plain text', () => {
    renderWithRouter(<Breadcrumb items={mockItems} />);
    
    const lastItem = screen.getByText('Reports');
    
    // Last item should be a span, not a link
    expect(lastItem.tagName).toBe('SPAN');
    expect(lastItem.closest('a')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = renderWithRouter(
      <Breadcrumb items={mockItems} className="custom-class" />
    );
    
    const nav = container.querySelector('nav');
    expect(nav).toHaveClass('custom-class');
  });

  it('adds title attribute for accessibility', () => {
    renderWithRouter(<Breadcrumb items={mockItems} />);
    
    const firstItem = screen.getByText('My Data Room');
    const lastItem = screen.getByText('Reports');
    
    expect(firstItem).toHaveAttribute('title', 'My Data Room');
    expect(lastItem).toHaveAttribute('title', 'Reports');
  });

  it('renders single item correctly', () => {
    const singleItem: BreadcrumbItem[] = [
      { id: 'room-1', name: 'My Data Room', path: '/data-rooms/room-1' },
    ];
    
    renderWithRouter(<Breadcrumb items={singleItem} />);
    
    const item = screen.getByText('My Data Room');
    
    // Single item should be rendered as text (last item)
    expect(item.tagName).toBe('SPAN');
    expect(item.closest('a')).not.toBeInTheDocument();
  });

  it('handles long item names with truncation classes', () => {
    const longNameItems: BreadcrumbItem[] = [
      { 
        id: 'room-1', 
        name: 'Very Long Data Room Name That Should Be Truncated', 
        path: '/data-rooms/room-1' 
      },
      { 
        id: 'folder-1', 
        name: 'Another Very Long Folder Name', 
        path: '/data-rooms/room-1/folders/folder-1' 
      },
    ];
    
    renderWithRouter(<Breadcrumb items={longNameItems} />);
    
    const firstItem = screen.getByText('Very Long Data Room Name That Should Be Truncated');
    const lastItem = screen.getByText('Another Very Long Folder Name');
    
    // Check for truncate class
    expect(firstItem.closest('a')).toHaveClass('truncate');
    expect(lastItem).toHaveClass('truncate');
  });

  it('sets correct aria-label for accessibility', () => {
    const { container } = renderWithRouter(<Breadcrumb items={mockItems} />);
    
    const nav = container.querySelector('nav');
    expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
  });

  it('handles items without ids', () => {
    const itemsWithoutIds: BreadcrumbItem[] = [
      { name: 'Home', path: '/home' },
      { name: 'Folder', path: '/home/folder' },
    ];
    
    renderWithRouter(<Breadcrumb items={itemsWithoutIds} />);
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Folder')).toBeInTheDocument();
  });
});

