import React from 'react';

export const BrowserRouter = ({ children }: { children: React.ReactNode }) => children;
export const Routes = ({ children }: { children: React.ReactNode }) => children;
export const Route = () => null;
export const Navigate = () => null;
export const Link = ({ children, to, ...props }: any) => 
  React.createElement('a', { href: to, ...props }, children);
export const NavLink = ({ children, to, ...props }: any) => 
  React.createElement('a', { href: to, ...props }, children);
export const Outlet = () => null;

export const useNavigate = () => jest.fn();
export const useParams = () => ({});
export const useLocation = () => ({
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default',
});
export const useSearchParams = () => [new URLSearchParams(), jest.fn()];
export const useMatch = () => null;
export const useResolvedPath = (to: string) => ({ pathname: to, search: '', hash: '' });

