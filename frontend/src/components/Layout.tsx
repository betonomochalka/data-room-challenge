import React, { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { FolderOpen, LogOut, User, ChevronRight, X } from 'lucide-react';
import FileTree from './FileTree';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/AlertDialog';

export const Layout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const showFileTree = true; // Always show file tree now
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isConnected, connect, disconnect, isDisconnecting } = useGoogleDrive();
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleGoogleDriveClick = () => {
    if (isConnected) {
      setIsDisconnectDialogOpen(true);
    } else {
      connect();
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setIsDisconnectDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl text-primary">
              <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="hidden sm:inline">Data Room</span>
              <span className="sm:hidden">DR</span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              {user && (
                <>
                  <div className="hidden md:flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <span className="max-w-[230px] truncate">{user.name || user.email}</span>
                  </div>
                  
                  {/* Google Drive Button */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleGoogleDriveClick}
                    disabled={isDisconnecting}
                  >
                    <img 
                      src="/drive_logo.svg" 
                      alt="Google Drive" 
                      className="h-4 w-4 sm:mr-2"
                    />
                    <span className="hidden sm:inline">{isConnected ? 'Connected' : 'Connect'}</span>
                  </Button>

                  {/* Disconnect Dialog */}
                  <AlertDialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to disconnect Google Drive? You won't be able to import files from Google Drive until you reconnect.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsDisconnectDialogOpen(false)}>
                          No
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleDisconnect}>
                          Yes
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Log Out</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        {showFileTree && (
          <>
            {/* Mobile Toggle Button - Full height on left edge */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden fixed left-0 top-16 bottom-16 w-8 bg-card border-r border-border flex items-center justify-center z-30 hover:bg-accent transition-colors"
              aria-label="Open file tree"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Backdrop for mobile */}
            {isSidebarOpen && (
              <div
                className="md:hidden fixed inset-0 bg-black/50 z-40"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* Sidebar - Desktop always visible, Mobile slide-out */}
            <aside
              className={`
                w-64 bg-card border-r border-border flex flex-col
                md:sticky md:top-16 md:h-[100vh] md:translate-x-0
                fixed top-16 bottom-16 left-0 z-50 transition-transform duration-300
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
              `}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <h2 className="text-lg font-semibold">File Tree</h2>
                {/* Close button for mobile */}
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="md:hidden p-1 hover:bg-accent rounded"
                  aria-label="Close file tree"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
                <FileTree />
              </div>
            </aside>
          </>
        )}
        <main className={`flex-1 overflow-y-auto ${showFileTree ? 'md:ml-0 ml-8' : ''}`}>
          <Outlet />
        </main>
      </div>

      <footer className="bg-card border-t border-border">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 Data Room. Secure document management.
          </p>
        </div>
      </footer>
    </div>
  );
};

