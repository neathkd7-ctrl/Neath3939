import React, { useState } from 'react';
import { Menu, X, User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type AppRoute =
  | { page: 'home' }
  | { page: 'upload' }
  | { page: 'edit'; modId: string }
  | { page: 'mod'; modId: string }
  | { page: 'profile'; username: string }
  | { page: 'my-mods' }
  | { page: 'admin' };

interface NavbarProps {
  route: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

export function Navbar({ route, onNavigate }: NavbarProps) {
  const { user, openAuthModal, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function go(next: AppRoute) {
    onNavigate(next);
    setMobileMenuOpen(false);
  }

  const navItems: Array<{ label: string; target: AppRoute; active: boolean }> = [
    {
      label: 'Discover',
      target: { page: 'home' },
      active: route.page === 'home' || route.page === 'mod',
    },
    {
      label: 'Upload Mod',
      target: { page: 'upload' },
      active: route.page === 'upload' || route.page === 'edit',
    },
    {
      label: 'My Mods',
      target: { page: 'my-mods' },
      active: route.page === 'my-mods',
    },
    {
      label: 'Admin',
      target: { page: 'admin' },
      active: route.page === 'admin',
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#24242D] bg-[#0E0E11]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => go({ page: 'home' })}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#F16436]"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect width="28" height="28" rx="6" fill="#F16436" />
            <rect x="6" y="7" width="4" height="5" rx="1" fill="#0E0E11" />
            <rect x="18" y="7" width="4" height="5" rx="1" fill="#0E0E11" />
            <rect x="9" y="13" width="10" height="8" rx="1.5" fill="#0E0E11" />
            <rect x="12" y="15" width="4" height="2.5" rx="0.5" fill="#F16436" />
          </svg>
          <span className="font-display text-xl font-extrabold tracking-tight text-white">
            DOG MODS
          </span>
        </button>

        {/* Zone 2: Primary Navigation Links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => go(item.target)}
              className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#F16436] ${
                item.active
                  ? 'text-white underline decoration-[#F16436] decoration-2 underline-offset-8'
                  : 'text-zinc-400 hover:text-white hover:underline hover:decoration-zinc-600 hover:underline-offset-8'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Single Primary Account / Sign In Action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={() => go({ page: 'profile', username: user.username })}
                className="flex min-h-10 items-center gap-2 rounded-lg border border-[#2A2A34] bg-[#16161B] px-3.5 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-[#F16436]/60 hover:bg-[#1E1E25] whitespace-nowrap shrink-0"
              >
                <UserIcon className="h-4 w-4 text-[#F16436]" />
                <span className="max-w-[130px] truncate">{user.username}</span>
              </button>
              <button
                type="button"
                onClick={signOut}
                title="Sign out"
                aria-label="Sign out"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2A2A34] bg-[#16161B] text-zinc-400 transition-colors hover:text-white hover:border-zinc-500"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="hidden md:inline-flex min-h-10 items-center justify-center rounded-lg bg-[#F16436] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#FF7849] whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#2A2A34] bg-[#16161B] text-zinc-200 md:hidden"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-[#24242D] bg-[#131318] px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1.5" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => go(item.target)}
                className={`flex min-h-11 items-center rounded-lg px-3.5 text-left text-sm font-medium transition-colors ${
                  item.active
                    ? 'bg-[#F16436]/15 text-[#F16436]'
                    : 'text-zinc-300 hover:bg-[#1E1E25] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}

            <div className="mt-2 border-t border-[#24242D] pt-3">
              {user ? (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => go({ page: 'profile', username: user.username })}
                    className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-[#2A2A34] bg-[#16161B] px-3.5 text-sm font-medium text-white"
                  >
                    <UserIcon className="h-4 w-4 text-[#F16436]" />
                    <span className="truncate">{user.username}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      setMobileMenuOpen(false);
                    }}
                    className="flex min-h-11 items-center justify-center rounded-lg border border-[#2A2A34] bg-[#16161B] px-4 text-sm font-medium text-zinc-300"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAuthModal('login');
                  }}
                  className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#F16436] px-4 text-sm font-semibold text-white"
                >
                  Sign In / Register
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
