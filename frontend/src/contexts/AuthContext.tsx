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
        }
        
        const { api } = await import('../lib/api'); // Lazy import
        const { data } = await api.get('/auth/me');
        if (data.success) {
          setUser(data.data);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('[AuthContext] fetchUser: Error fetching user profile', error);
        setUser(null);
      }
    };

    const finishInitialization = () => {
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        setLoading(false);
      }
    };

    // Set a timeout to ensure loading is always set to false
    const timeoutId = setTimeout(() => {
      if (!isInitializedRef.current) {
        console.error('[AuthContext] Initialization timeout - forcing loading to false');
        finishInitialization();
      }
    }, 30000); // 30 second timeout

    // Prevent multiple initializations
    if (initializationStartedRef.current) {
      return;
    }
    initializationStartedRef.current = true;

    // Get initial session and user
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
          await fetchUser();
        } else {
          setUser(null);
        }
        
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
      // Skip INITIAL_SESSION - we handle it in getSession()
      // INITIAL_SESSION fires synchronously when onAuthStateChange is called,
      // but we're already handling initialization in getSession()
      if (event === 'INITIAL_SESSION') {
        // Don't do anything here - let getSession() handle initialization
        return;
      }
      
      // For other events, process them normally
      // Set token BEFORE calling fetchUser
      setAuthToken(session?.access_token ?? null);
      setSession(session);
      
      // Handle other auth events
      if (session) {
        await fetchUser();
      } else {
        setUser(null);
      }
      
      // Only finish initialization if not already done (for SIGNED_IN/SIGNED_OUT during init)
      if (!isInitializedRef.current) {
        finishInitialization();
      }
      
      if (session?.user) {
        const loginToastShown = sessionStorage.getItem('login_toast_shown');
        if (event === 'SIGNED_IN' && !loginToastShown) {
          toast.success(SUCCESS_MESSAGES.LOGIN_SUCCESS);
          sessionStorage.setItem('login_toast_shown', 'true');
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
      // Redirect to the correct frontend domain
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: process.env.REACT_APP_SITE_URL || 'http://localhost:3000',
        },
      });
      if (error) throw error;
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

