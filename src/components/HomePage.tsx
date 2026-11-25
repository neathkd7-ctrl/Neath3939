import React, { useMemo, useState } from 'react';
import { Search, Upload, ArrowRight, Flame, Clock, RotateCcw } from 'lucide-react';
import type { Category, ModItem } from '../types';
import { BEDROCK_VERSIONS, formatNumber } from '../types';
import { ModCard } from './ModCard';

interface HomePageProps {
  mods: ModItem[];
  categories: Category[];
  loading: boolean;
  onSelectMod: (mod: ModItem) => void;
  onNavigateUpload: () => void;
  onSelectCreator: (username: string) => void;
}

export function HomePage({
  mods,
  categories,
  loading,
  onSelectMod,
  onNavigateUpload,
  onSelectCreator,
}: HomePageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVersion, setSelectedVersion] = useState('all');
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');

  const featuredMods = useMemo(
    () => mods.filter((m) => m.is_featured).slice(0, 3),
    [mods]
  );

  const popularMods = useMemo(
    () => [...mods].sort((a, b) => b.downloads - a.downloads).slice(0, 6),
    [mods]
  );

  const latestMods = useMemo(
    () =>
      [...mods]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6),
    [mods]
  );

  const isFiltering =
    searchQuery.trim().length > 0 || selectedCategory !== 'all' || selectedVersion !== 'all';

  const filteredMods = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = mods.filter((m) => {
      const matchesQ =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.creator_name.toLowerCase().includes(q) ||
        m.file_original_name.toLowerCase().includes(q);
      const matchesCat =
        selectedCategory === 'all' ||
        m.category_slug === selectedCategory ||
        m.category_id === selectedCategory;
      const matchesVer = selectedVersion === 'all' || m.mc_version === selectedVersion;
      return matchesQ && matchesCat && matchesVer;
    });

    if (sortBy === 'popular') {
      return [...list].sort((a, b) => b.downloads - a.downloads);
    }
    return [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [mods, searchQuery, selectedCategory, selectedVersion, sortBy]);

  const heroMod = featuredMods[0] || mods[0];

  function resetFilters() {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedVersion('all');
  }

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Banner Showcase */}
      <section className="relative overflow-hidden border-b border-[#24242D] bg-[#111115]">
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
            {/* Left Copy & Search Focal Column */}
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="mb-3 text-xs font-semibold tracking-wider text-[#F16436]">
                MINECRAFT BEDROCK EDITION REPOSITORY
              </p>
              <h1
                className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl"
                style={{ textWrap: 'balance' }}
              >
                Mods, Addons &amp; Worlds Built for Bedrock.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-300">
                Download verified <span className="font-mono text-zinc-100">.mcaddon</span>,{' '}
                <span className="font-mono text-zinc-100">.mcpack</span>,{' '}
                <span className="font-mono text-zinc-100">.mcworld</span>, and{' '}
                <span className="font-mono text-zinc-100">.zip</span> packages crafted for Windows,
                Android, and iOS Bedrock players.
              </p>

              {/* Search Bar */}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Bedrock mods, addons, shaders, creators..."
                    aria-label="Search Minecraft Bedrock mods"
                    className="min-h-12 w-full rounded-lg border border-[#2E2E38] bg-[#16161B] pl-10 pr-4 text-sm text-white placeholder-zinc-500 transition-colors focus:border-[#F16436] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={onNavigateUpload}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#F16436] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#FF7849] whitespace-nowrap shrink-0"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Mod</span>
                </button>
              </div>
            </div>

            {/* Right Featured Showcase Image */}
            <div className="lg:col-span-6">
              <div
                onClick={() => heroMod && onSelectMod(heroMod)}
                role={heroMod ? 'button' : undefined}
                tabIndex={heroMod ? 0 : undefined}
                onKeyDown={(e) => {
                  if (heroMod && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSelectMod(heroMod);
                  }
                }}
                className="group relative h-64 overflow-hidden rounded-xl border border-[#2A2A34] bg-[#16161B] sm:h-80 lg:h-full lg:min-h-[320px] cursor-pointer"
              >
                <img
                  src="/src/assets/images/hero_bedrock_showcase_1795564651886.jpg"
                  alt="DOG MODS Featured Minecraft Bedrock Showcase"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                {heroMod && (
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#F16436]">
                        Featured Bedrock Mod · MC {heroMod.mc_version}
                      </p>
                      <h2 className="mt-0.5 truncate font-display text-xl font-bold text-white">
                        {heroMod.title}
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-300 tabular-nums">
                        by {heroMod.creator_name} · {formatNumber(heroMod.downloads)} downloads
                      </p>
                    </div>
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F16436] text-white transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Container */}
      <div className="mx-auto max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
        {/* Category Filter Tabs & Version Filter Bar */}
        <section aria-label="Filter mods by category and version" className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Scrollable Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`min-h-10 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-[#F16436] text-white'
                    : 'border border-[#24242D] bg-[#16161B] text-zinc-300 hover:border-[#3A3A47] hover:text-white'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`min-h-10 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === cat.slug
                      ? 'bg-[#F16436] text-white'
                      : 'border border-[#24242D] bg-[#16161B] text-zinc-300 hover:border-[#3A3A47] hover:text-white'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Version & Sort Controls */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                aria-label="Filter by Minecraft Bedrock version"
                className="min-h-10 rounded-lg border border-[#2A2A34] bg-[#16161B] px-3 py-2 text-sm text-zinc-200 focus:border-[#F16436] focus:outline-none"
              >
                <option value="all">All Bedrock Versions</option>
                {BEDROCK_VERSIONS.map((v) => (
                  <option key={v} value={v}>
                    Bedrock {v}
                  </option>
                ))}
              </select>

              {isFiltering && (
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'latest' | 'popular')}
                  aria-label="Sort mods"
                  className="min-h-10 rounded-lg border border-[#2A2A34] bg-[#16161B] px-3 py-2 text-sm text-zinc-200 focus:border-[#F16436] focus:outline-none"
                >
                  <option value="latest">Sort: Latest</option>
                  <option value="popular">Sort: Most Popular</option>
                </select>
              )}

              {isFiltering && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#2A2A34] bg-[#16161B] px-3 py-2 text-sm text-zinc-300 hover:text-white whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="h-80 animate-pulse rounded-xl border border-[#24242D] bg-[#16161B]"
              />
            ))}
          </div>
        ) : isFiltering ? (
          /* Filtered Search / Category View */
          <section className="space-y-5">
            <div className="flex items-center justify-between border-b border-[#24242D] pb-3">
              <h2 className="font-display text-xl font-bold text-white">
                Search Results{' '}
                <span className="ml-1.5 font-mono text-sm font-normal text-zinc-400 tabular-nums">
                  ({filteredMods.length})
                </span>
              </h2>
            </div>

            {filteredMods.length === 0 ? (
              <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-12 text-center">
                <p className="font-display text-lg font-semibold text-white">
                  No Minecraft Bedrock mods match your filters
                </p>
                <p className="mt-1.5 text-sm text-zinc-400">
                  Try clearing your search terms or selecting a different Bedrock version.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#F16436] px-4 py-2 text-sm font-semibold text-white hover:bg-[#FF7849]"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMods.map((mod) => (
                  <ModCard
                    key={mod.id}
                    mod={mod}
                    onSelect={onSelectMod}
                    onCreatorClick={onSelectCreator}
                  />
                ))}
              </div>
            )}
          </section>
        ) : mods.length === 0 ? (
          <section className="rounded-xl border border-[#24242D] bg-[#16161B] p-12 text-center">
            <p className="font-display text-xl font-bold text-white">
              No Minecraft Bedrock mods published yet
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Upload a <span className="font-mono text-zinc-200">.mcaddon</span>,{' '}
              <span className="font-mono text-zinc-200">.mcpack</span>,{' '}
              <span className="font-mono text-zinc-200">.mcworld</span>, or{' '}
              <span className="font-mono text-zinc-200">.zip</span> package to get started.
            </p>
            <button
              type="button"
              onClick={onNavigateUpload}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#F16436] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#FF7849]"
            >
              <Upload className="h-4 w-4" />
              <span>Upload First Mod</span>
            </button>
          </section>
        ) : (
          /* Default Home Sections: Popular -> Latest */
          <>
            {/* Popular Mods */}
            <section className="space-y-5">
              <div className="flex items-center justify-between border-b border-[#24242D] pb-3">
                <div className="flex items-center gap-2.5">
                  <Flame className="h-5 w-5 text-[#F16436]" />
                  <h2 className="font-display text-2xl font-bold text-white">Popular Mods</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {popularMods.map((mod) => (
                  <ModCard
                    key={mod.id}
                    mod={mod}
                    onSelect={onSelectMod}
                    onCreatorClick={onSelectCreator}
                  />
                ))}
              </div>
            </section>

            {/* Latest Mods */}
            <section className="space-y-5">
              <div className="flex items-center justify-between border-b border-[#24242D] pb-3">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-5 w-5 text-[#F16436]" />
                  <h2 className="font-display text-2xl font-bold text-white">Latest Mods</h2>
                </div>
                <button
                  type="button"
                  onClick={onNavigateUpload}
                  className="text-sm font-medium text-[#F16436] hover:underline whitespace-nowrap"
                >
                  Submit yours
                </button>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {latestMods.map((mod) => (
                  <ModCard
                    key={mod.id}
                    mod={mod}
                    onSelect={onSelectMod}
                    onCreatorClick={onSelectCreator}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
