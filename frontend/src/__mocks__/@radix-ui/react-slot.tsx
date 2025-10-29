import * as React from 'react';

export const Slot = ({ children, ...props }: any) => {
  if (React.isValidElement(children)) {
    return React.cloneElement(children, props);
  }
  return children;
};

