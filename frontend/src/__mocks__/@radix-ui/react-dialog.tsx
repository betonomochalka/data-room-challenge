import * as React from 'react';

export const Root = ({ children, open, onOpenChange }: any) => {
  return open ? <div data-testid="dialog-root">{children}</div> : null;
};

export const Trigger = ({ children, ...props }: any) => (
  <button {...props}>{children}</button>
);

export const Portal = ({ children }: any) => <div>{children}</div>;

export const Overlay = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="dialog-overlay" {...props}>
      {children}
    </div>
  )
);
Overlay.displayName = 'DialogOverlay';

export const Content = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="dialog-content" {...props}>
      {children}
    </div>
  )
);
Content.displayName = 'DialogContent';

export const Title = React.forwardRef<HTMLHeadingElement, any>(
  ({ children, ...props }, ref) => (
    <h2 ref={ref} data-testid="dialog-title" {...props}>
      {children}
    </h2>
  )
);
Title.displayName = 'DialogTitle';

export const Description = React.forwardRef<HTMLParagraphElement, any>(
  ({ children, ...props }, ref) => (
    <p ref={ref} data-testid="dialog-description" {...props}>
      {children}
    </p>
  )
);
Description.displayName = 'DialogDescription';

export const Close = ({ children, ...props }: any) => (
  <button {...props}>{children}</button>
);

