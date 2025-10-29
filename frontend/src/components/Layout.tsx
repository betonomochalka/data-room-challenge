import React, { useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { FolderOpen, LogOut, User, ChevronRight, X } from 'lucide-react';
import FileTree from './FileTree';

export const Layout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const showFileTree = params.id;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-card border-b border-border">
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
                    <span className="max-w-[150px] truncate">{user.name || user.email}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
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
                w-64 bg-card border-r border-border p-4 flex flex-col
                md:relative md:translate-x-0
                fixed top-16 bottom-16 left-0 z-50 transition-transform duration-300
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
              `}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Files</h2>
                {/* Close button for mobile */}
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="md:hidden p-1 hover:bg-accent rounded"
                  aria-label="Close file tree"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
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

