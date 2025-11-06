import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Set a safety timeout to redirect to login if loading takes too long
    // Increased timeout to 15s to give AuthContext time to finish (which has 10s timeout)
    if (loading) {
      timeoutRef.current = setTimeout(() => {
        console.warn('[PrivateRoute] Loading timeout exceeded - redirecting to login');
        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          navigate('/login', { replace: true });
        }
      }, 15000); // 15 second timeout (longer than AuthContext's 10s)
    } else {
      // Clear timeout if loading finishes
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Redirect to login if not loading and no user
      if (!user && !hasRedirectedRef.current) {
        console.log('[PrivateRoute] No user found, redirecting to login');
        hasRedirectedRef.current = true;
        navigate('/login', { replace: true });
      }
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    // Show loading while redirect happens (useNavigate in useEffect handles the redirect)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
};

