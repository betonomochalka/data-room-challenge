import * as React from 'react';

export const Root = React.forwardRef<HTMLLabelElement, any>(
  ({ children, ...props }, ref) => (
    <label ref={ref} {...props}>
      {children}
    </label>
  )
);
Root.displayName = 'Label';

