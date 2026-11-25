/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider } from './context/AuthContext';
import { Navbar, type AppRoute } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { UploadModPage } from './components/UploadModPage';
import { ModDetailsPage } from './components/ModDetailsPage';
import { ProfilePage } from './components/ProfilePage';
import { AdminDashboardPage } from './components/AdminDashboardPage';
import { AuthModal } from './components/AuthModal';
import { fetchCategories, fetchMods } from './lib/api';
import { DEFAULT_CATEGORIES, type Category, type ModItem } from './types';

function getInitialRoute(): AppRoute {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const modParam = params.get('mod');
    if (modParam && modParam.trim()) {
      return { page: 'mod', modId: modParam.trim() };
    }
  }
  return { page: 'home' };
}

function DogModsShell() {
  const [route, setRoute] = useState<AppRoute>(getInitialRoute);
  const [mods, setMods] = useState<ModItem[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string>('');

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const [modsRes, catRes] = await Promise.all([fetchMods(), fetchCategories()]);
      setMods(modsRes.mods);
      if (catRes.categories.length > 0) {
        setCategories(catRes.categories);
      }
    } catch {
      setCategories((prev) => (prev.length > 0 ? prev : DEFAULT_CATEGORIES));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => {
      setToast((curr) => (curr === message ? '' : curr));
    }, 3500);
  }

  function navigate(next: AppRoute) {
    setRoute(next);
    if (typeof window !== 'undefined') {
      const base = import.meta.env.BASE_URL || '/';
      const nextUrl =
        next.page === 'mod' ? `${base}?mod=${encodeURIComponent(next.modId)}` : base;
      window.history.replaceState(null, '', nextUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0E0E11] text-zinc-100">
      <Navbar route={route} onNavigate={navigate} />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${route.page}-${'modId' in route ? route.modId : ''}-${'username' in route ? route.username : ''}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {route.page === 'home' && (
              <HomePage
                mods={mods}
                categories={categories}
                loading={loading}
                onSelectMod={(mod) => navigate({ page: 'mod', modId: mod.id })}
                onNavigateUpload={() => navigate({ page: 'upload' })}
                onSelectCreator={(username) => navigate({ page: 'profile', username })}
              />
            )}

            {route.page === 'upload' && (
              <UploadModPage
                categories={categories}
                onCancel={() => navigate({ page: 'home' })}
                onSuccess={(createdMod) => {
                  loadCatalog();
                  showToast(`Published "${createdMod.title}" to DOG MODS.`);
                  navigate({ page: 'mod', modId: createdMod.id });
                }}
              />
            )}

            {route.page === 'edit' && (
              <UploadModPage
                categories={categories}
                editModId={route.modId}
                onCancel={() => navigate({ page: 'mod', modId: route.modId })}
                onSuccess={(updatedMod) => {
                  loadCatalog();
                  showToast(`Updated "${updatedMod.title}".`);
                  navigate({ page: 'mod', modId: updatedMod.id });
                }}
              />
            )}

            {route.page === 'mod' && (
              <ModDetailsPage
                modId={route.modId}
                onBack={() => {
                  loadCatalog();
                  navigate({ page: 'home' });
                }}
                onEdit={(mod) => navigate({ page: 'edit', modId: mod.id })}
                onDeleted={() => {
                  loadCatalog();
                  showToast('Mod deleted from storage.');
                  navigate({ page: 'home' });
                }}
                onSelectCreator={(username) => navigate({ page: 'profile', username })}
              />
            )}

            {route.page === 'my-mods' && (
              <ProfilePage
                mode="my-mods"
                onSelectMod={(mod) => navigate({ page: 'mod', modId: mod.id })}
                onEditMod={(mod) => navigate({ page: 'edit', modId: mod.id })}
                onUploadClick={() => navigate({ page: 'upload' })}
                onModMutated={() => {
                  loadCatalog();
                  showToast('Mod removed.');
                }}
              />
            )}

            {route.page === 'profile' && (
              <ProfilePage
                mode="profile"
                username={route.username}
                onSelectMod={(mod) => navigate({ page: 'mod', modId: mod.id })}
                onEditMod={(mod) => navigate({ page: 'edit', modId: mod.id })}
                onUploadClick={() => navigate({ page: 'upload' })}
                onModMutated={loadCatalog}
              />
            )}

            {route.page === 'admin' && (
              <AdminDashboardPage
                categories={categories}
                onRefreshGlobalData={loadCatalog}
                onSelectMod={(mod) => navigate({ page: 'mod', modId: mod.id })}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Clean CurseForge-Inspired Footer */}
      <footer className="border-t border-[#24242D] bg-[#111115]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-zinc-400 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-bold text-white">DOG MODS</span>
            <span aria-hidden="true">·</span>
            <span>Minecraft Bedrock Edition Mod Hub</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => navigate({ page: 'home' })}
              className="hover:text-white"
            >
              Discover
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'upload' })}
              className="hover:text-white"
            >
              Upload Mod
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'my-mods' })}
              className="hover:text-white"
            >
              My Mods
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'admin' })}
              className="hover:text-white"
            >
              Admin
            </button>
          </div>
        </div>
      </footer>

      <AuthModal />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 rounded-lg border border-[#F16436]/50 bg-[#16161B] px-4 py-3 text-sm font-medium text-white shadow-2xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DogModsShell />
    </AuthProvider>
  );
}
