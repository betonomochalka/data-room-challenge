import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Reset redirect flag when user or loading state changes significantly
    // This ensures redirects work correctly if auth state changes
    if (user) {
      hasRedirectedRef.current = false;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If loading, set a timeout to redirect if it takes too long
    if (loading) {
      timeoutRef.current = setTimeout(() => {
        console.warn('[PrivateRoute] Loading timeout exceeded - redirecting to login');
        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          navigate('/login', { replace: true });
        }
      }, 12000); // 12 second timeout (longer than AuthContext's 8s)
      return;
    }

    // If not loading and no user, redirect immediately
    if (!user && !hasRedirectedRef.current) {
      console.log('[PrivateRoute] No user found after loading finished, redirecting to login');
      hasRedirectedRef.current = true;
      navigate('/login', { replace: true });
    }

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [loading, user, navigate]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no user, show loading while redirect happens
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
};

