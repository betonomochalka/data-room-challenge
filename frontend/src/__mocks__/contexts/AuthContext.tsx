import React, { ReactNode } from 'react';

const mockAuthContext = {
  user: null,
  session: null,
  loading: false,
  signInWithGoogle: jest.fn(() => Promise.resolve()),
  signOut: jest.fn(() => Promise.resolve()),
};

export const useAuth = () => mockAuthContext;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <div>{children}</div>;
};

