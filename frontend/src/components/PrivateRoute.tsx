import React from 'react';

// Login is skipped: the auth gate is bypassed and children render directly.
export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

