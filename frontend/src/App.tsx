/**
 * ============================================
 * MAIN APP COMPONENT - Data Room Application
 * ============================================
 * 
 * This is the root component of our React application. It sets up:
 * 1. React Query for data fetching and caching
 * 2. Authentication context for user management
 * 3. React Router for navigation between pages
 * 4. Lazy loading for better performance
 * 
 * For junior developers:
 * - This file is the "entry point" of our app
 * - All pages are loaded lazily (only when needed) to make the app faster
 * - React Query helps us manage API calls and caching automatically
 * - The AuthProvider gives us access to user information throughout the app
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { PrivateRoute } from './components/PrivateRoute';

/**
 * LAZY LOADING - Performance Optimization
 * 
 * Instead of loading all pages at once, we load them only when needed.
 * This makes the initial app load much faster.
 * 
 * The .then() part extracts the named export from each module.
 */
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const DataRoomRoot = lazy(() => import('./pages/DataRoomRoot').then(module => ({ default: module.DataRoomRoot })));
const FolderView = lazy(() => import('./pages/FolderView').then(module => ({ default: module.FolderView })));

/**
 * LOADING FALLBACK COMPONENT
 * 
 * This shows a spinner while pages are being loaded.
 * It appears when lazy-loaded components are being downloaded.
 */
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

/**
 * REACT QUERY CLIENT CONFIGURATION
 * 
 * React Query helps us:
 * - Cache API responses automatically
 * - Refetch data when needed
 * - Show loading states
 * - Handle errors gracefully
 * 
 * Configuration explained:
 * - refetchOnWindowFocus: false - Don't refetch when user switches tabs
 * - retry: 1 - Only retry failed requests once
 * - staleTime: 1 minute - Data is considered fresh for 1 minute
 * - gcTime: 5 minutes - Keep unused data in cache for 5 minutes
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60 * 1000, // 1 minute default
      gcTime: 5 * 60 * 1000, // 5 minutes default cache
    },
  },
});

/**
 * MAIN APP COMPONENT
 * 
 * This is where we set up all the providers and routing.
 * Think of it as the "foundation" of our app.
 */
function App() {
  return (
    // React Query Provider - Gives all components access to query client
    <QueryClientProvider client={queryClient}>
      {/* Auth Provider - Gives all components access to user data */}
      <AuthProvider>
        {/* Router - Handles navigation between pages */}
        <Router>
          {/* Suspense - Shows loading spinner while lazy components load */}
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* PUBLIC ROUTES - Anyone can access these */}
              <Route path="/login" element={<Login />} />
              
              {/* PROTECTED ROUTES - Only logged-in users can access these */}
              <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route path="/" element={<DataRoomRoot />} />
                <Route path="/folders/*" element={<FolderView />} />
              </Route>

              {/* CATCH-ALL ROUTE - Redirects unknown URLs to home page */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
        {/* Toast notifications */}
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
