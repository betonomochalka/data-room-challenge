/**
 * ============================================
 * AUTHENTICATION CONTEXT - User Management
 * ============================================
 * 
 * This file manages user authentication throughout the app using Supabase.
 * It provides:
 * 1. User login/logout functionality
 * 2. User state management
 * 3. Session persistence
 * 4. Google OAuth integration
 * 
 * For junior developers:
 * - Context is React's way of sharing data between components
 * - This context makes user data available everywhere in the app
 * - Supabase handles the complex authentication logic for us
 * - We use Google OAuth so users can sign in with their Google account
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { SUCCESS_MESSAGES } from '../lib/errorMessages';
import { User } from '../types'; // Import your own User type
import { setAuthToken } from '../lib/api'; // Import the new function

/**
 * AUTH CONTEXT TYPE DEFINITION
 * 
 * This defines what data and functions our auth context provides.
 * TypeScript uses this to ensure we don't make mistakes.
 */
interface AuthContextType {
  user: User | null;                    // Current logged-in user from YOUR database
  session: Session | null;             // Current session data
  signInWithGoogle: () => Promise<void>; // Function to sign in with Google
  signOut: () => Promise<void>;         // Function to sign out
  loading: boolean;                     // Whether we're still checking auth status
}

/**
 * CREATE AUTH CONTEXT
 * 
 * This creates the context that will hold our auth data.
 * We start with undefined because we haven't provided it yet.
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * USE AUTH HOOK
 * 
 * This is a custom hook that components use to access auth data.
 * It ensures the component is wrapped in an AuthProvider.
 * 
 * Usage in components:
 * const { user, signInWithGoogle, signOut } = useAuth();
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isInitializedRef = useRef(false);
  const initializationStartedRef = useRef(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const fetchUser = async (sessionToken?: string) => {
      try {
        // Use provided token or get current session
        let accessToken = sessionToken;
        if (!accessToken) {
          const currentSession = await supabase.auth.getSession();
          accessToken = currentSession.data.session?.access_token;
        }
        
        if (!accessToken) {
          console.warn('[AuthContext] fetchUser: No access token in session');
          setUser(null);
          return;
        }
        
        setAuthToken(accessToken);
        
        const { api } = await import('../lib/api'); // Lazy import
        const { data } = await api.get('/auth/me');
        if (data.success) {
          console.log('[AuthContext] fetchUser: User fetched successfully', data.data);
          if (isMounted) {
            setUser(data.data);
          }
        } else {
          console.warn('[AuthContext] fetchUser: API returned unsuccessful response', data);
          if (isMounted) {
            setUser(null);
          }
        }
      } catch (error) {
        console.error('[AuthContext] fetchUser: Error fetching user profile', error);
        // Only set user to null if it's a 401 (unauthorized)
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status === 401) {
            console.warn('[AuthContext] fetchUser: 401 Unauthorized - clearing user');
            if (isMounted) {
              setUser(null);
            }
          }
        }
      }
    };

    const finishInitialization = () => {
      if (!isInitializedRef.current && isMounted) {
        isInitializedRef.current = true;
        setLoading(false);
        console.log('[AuthContext] Initialization finished');
      }
    };

    // Prevent multiple initializations
    if (initializationStartedRef.current) {
      return;
    }
    initializationStartedRef.current = true;

    // Check if we're returning from OAuth callback (has hash fragments)
    const isOAuthCallback = window.location.hash.includes('access_token') || 
                           window.location.hash.includes('error') ||
                           window.location.hash.includes('error_description');

    // Set a timeout to ensure loading is always set to false
    const timeoutDuration = isOAuthCallback ? 5000 : 8000;
    timeoutId = setTimeout(() => {
      if (!isInitializedRef.current && isMounted) {
        console.warn('[AuthContext] Initialization timeout - forcing loading to false');
        finishInitialization();
      }
    }, timeoutDuration);

    // Always call getSession() first - it will handle hash fragments if present
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (!isMounted) return;
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        if (error) {
          console.error('[AuthContext] Error getting session:', error);
          setUser(null);
          setSession(null);
          finishInitialization();
          return;
        }

        // Set token and session
        setAuthToken(session?.access_token ?? null);
        setSession(session);
        
        if (session?.access_token) {
          // Fetch user with timeout to prevent blocking
          const fetchUserPromise = fetchUser(session.access_token).catch((error) => {
            console.error('[AuthContext] fetchUser error:', error);
          });
          
          const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              console.warn('[AuthContext] fetchUser taking too long, finishing initialization');
              resolve();
            }, 5000); // 5 second timeout for fetchUser
          });
          
          await Promise.race([fetchUserPromise, timeoutPromise]);
        } else {
          setUser(null);
        }
        
        // Always finish initialization after getSession()
        finishInitialization();
      })
      .catch((error) => {
        if (!isMounted) return;
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        console.error('[AuthContext] Error getting session:', error);
        setUser(null);
        setSession(null);
        finishInitialization();
      });

    // Listen for auth changes (but don't interfere with initial load)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      console.log('[AuthContext] Auth state change:', event, session ? 'has session' : 'no session');
      
      // Skip INITIAL_SESSION - getSession() already handled it
      if (event === 'INITIAL_SESSION') {
        // But ensure initialization finishes if it hasn't yet
        if (!isInitializedRef.current) {
          finishInitialization();
        }
        return;
      }
      
      // Clear timeout if still running
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Set token and session
      setAuthToken(session?.access_token ?? null);
      setSession(session);
      
      // Handle auth events
      if (session?.access_token) {
        await fetchUser(session.access_token);
      } else {
        setUser(null);
      }
      
      // Finish initialization if not already done (safety net)
      if (!isInitializedRef.current) {
        finishInitialization();
      }
      
      // Handle SIGNED_IN event (especially important for OAuth callbacks)
      if (event === 'SIGNED_IN' && session?.user) {
        const loginToastShown = sessionStorage.getItem('login_toast_shown');
        if (!loginToastShown) {
          toast.success(SUCCESS_MESSAGES.LOGIN_SUCCESS);
          sessionStorage.setItem('login_toast_shown', 'true');
        }
        
        // Clean up OAuth hash fragments if present
        if (window.location.hash.includes('access_token')) {
          setTimeout(() => {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }, 100);
        }
      }
      
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('login_toast_shown');
      }
    });

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      // Use current origin for redirect URL (works in both dev and production)
      // Fallback to env variable or localhost for edge cases
      // Redirect to root path after OAuth completes
      const baseUrl = process.env.REACT_APP_SITE_URL || window.location.origin;
      const redirectUrl = `${baseUrl}/`;
      
      // Redirect to the correct frontend domain
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
      // Note: setLoading(false) is not called here because the page will redirect
      // The loading state will be reset when the user returns from OAuth
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, signInWithGoogle, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

