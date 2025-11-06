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
    const fetchUser = async () => {
      try {
        // Ensure token is set before making the request
        const currentSession = await supabase.auth.getSession();
        if (currentSession.data.session?.access_token) {
          setAuthToken(currentSession.data.session.access_token);
        } else {
          console.warn('[AuthContext] fetchUser: No access token in session');
          setUser(null);
          return;
        }
        
        const { api } = await import('../lib/api'); // Lazy import
        const { data } = await api.get('/auth/me');
        if (data.success) {
          console.log('[AuthContext] fetchUser: User fetched successfully', data.data);
          setUser(data.data);
        } else {
          console.warn('[AuthContext] fetchUser: API returned unsuccessful response', data);
          setUser(null);
        }
      } catch (error) {
        console.error('[AuthContext] fetchUser: Error fetching user profile', error);
        // Don't set user to null on error - keep existing session
        // The error might be temporary (network issue, etc.)
        // Only set to null if it's a 401 (unauthorized)
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status === 401) {
            console.warn('[AuthContext] fetchUser: 401 Unauthorized - clearing user');
            setUser(null);
          }
        }
      }
    };

    const finishInitialization = () => {
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        setLoading(false);
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
    // Use shorter timeout for OAuth callbacks
    // Reduced from 30s to 10s for normal page loads to fail faster
    const timeoutDuration = isOAuthCallback ? 5000 : 10000;
    let timeoutId: NodeJS.Timeout = setTimeout(() => {
      if (!isInitializedRef.current) {
        if (isOAuthCallback) {
          console.warn('[AuthContext] OAuth callback timeout - checking session');
          // Fallback: try to get session anyway
          supabase.auth.getSession()
            .then(async ({ data: { session }, error }) => {
              if (!error && session) {
                setAuthToken(session.access_token ?? null);
                setSession(session);
                await fetchUser();
              }
              finishInitialization();
            })
            .catch(() => {
              finishInitialization();
            });
        } else {
          console.error('[AuthContext] Initialization timeout - forcing loading to false');
          finishInitialization();
        }
      }
    }, timeoutDuration);

    // For OAuth callbacks, Supabase will process hash fragments and fire SIGNED_IN event
    // But we also need to check session immediately in case hash was already processed
    // For normal page loads, we call getSession() to check for existing session
    
    // Always call getSession() - it will handle hash fragments if present
    // Supabase processes hash fragments synchronously when getSession() is called
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        clearTimeout(timeoutId);
        
        if (error) {
          console.error('[AuthContext] Error getting session:', error);
          setUser(null);
          setSession(null);
          finishInitialization();
          return;
        }

        // Set token BEFORE calling fetchUser
        setAuthToken(session?.access_token ?? null);
        setSession(session);
        
        if (session) {
          // Add timeout to fetchUser to prevent it from blocking initialization
          // Use Promise.race to ensure fetchUser doesn't block initialization
          const fetchUserPromise = fetchUser().catch((error) => {
            // fetchUser already handles errors internally, just log here
            console.error('[AuthContext] fetchUser error:', error);
          });
          
          const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              console.warn('[AuthContext] fetchUser taking too long, finishing initialization');
              resolve();
            }, 5000); // 5 second timeout for fetchUser
          });
          
          // Race between fetchUser and timeout - whichever finishes first wins
          // This ensures initialization completes even if fetchUser is slow
          await Promise.race([fetchUserPromise, timeoutPromise]);
        } else {
          setUser(null);
        }
        
        // Always finish initialization after getSession()
        // onAuthStateChange will handle subsequent updates
        finishInitialization();
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error('[AuthContext] Error getting session:', error);
        setUser(null);
        setSession(null);
        finishInitialization();
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Auth state change:', event, session ? 'has session' : 'no session');
      
      // Skip INITIAL_SESSION - getSession() already handled it
      // INITIAL_SESSION fires synchronously when onAuthStateChange is called,
      // but we've already processed it in getSession()
      if (event === 'INITIAL_SESSION') {
        return;
      }
      
      // Clear timeout since we're processing auth state change
      clearTimeout(timeoutId);
      
      // Set token BEFORE calling fetchUser
      setAuthToken(session?.access_token ?? null);
      setSession(session);
      
      // Handle auth events (only after initialization is complete)
      if (session) {
        await fetchUser();
      } else {
        setUser(null);
      }
      
      // Finish initialization if not already done (shouldn't happen, but safety net)
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
      clearTimeout(timeoutId);
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

