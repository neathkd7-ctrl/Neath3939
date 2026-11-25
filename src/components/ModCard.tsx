import React, { useState } from 'react';
import { Download, Box } from 'lucide-react';
import type { ModItem } from '../types';
import { formatBytes, formatNumber } from '../types';

interface ModCardProps {
  mod: ModItem;
  onSelect: (mod: ModItem) => void;
  onCreatorClick?: (username: string) => void;
}

export function ModCard({ mod, onSelect, onCreatorClick }: ModCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <article
      onClick={() => onSelect(mod)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(mod);
        }
      }}
      className="group flex flex-col overflow-hidden rounded-xl border border-[#24242D] bg-[#16161B] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#F16436]/60 hover:bg-[#1A1A21] focus-visible:outline-2 focus-visible:outline-[#F16436] cursor-pointer"
    >
      {/* Square/4:3 Artwork Frame */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#111115]">
        {!imgError && mod.image_url ? (
          <img
            src={mod.image_url}
            alt={mod.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1C1C24] via-[#15151B] to-[#0E0E11] p-4 text-center">
            <Box className="h-9 w-9 text-[#F16436]/80" />
            <span className="line-clamp-1 font-display text-sm font-semibold text-zinc-300">
              {mod.title}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#16161B] via-[#16161B]/40 to-transparent" />
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          {/* Quiet 1-line text metadata (Zero-Pill Discipline) */}
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-zinc-400 truncate">
            <span className="text-[#F16436] font-medium truncate">{mod.category_name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums shrink-0">MC {mod.mc_version}</span>
          </div>

          <h3 className="font-display text-base font-bold text-white transition-colors group-hover:text-[#F16436] line-clamp-1">
            {mod.title}
          </h3>

          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400 line-clamp-2">
            {mod.description}
          </p>
        </div>

        {/* Footer Metadata Row */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#22222A] pt-3 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5 min-w-0">
            <span>by</span>
            {onCreatorClick ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreatorClick(mod.creator_name);
                }}
                className="truncate font-medium text-zinc-200 hover:text-[#F16436] hover:underline"
              >
                {mod.creator_name}
              </button>
            ) : (
              <span className="truncate font-medium text-zinc-200">{mod.creator_name}</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 font-mono tabular-nums shrink-0 text-zinc-300">
            <span className="text-zinc-500">{formatBytes(mod.file_size)}</span>
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5 text-[#F16436]" />
              {formatNumber(mod.downloads)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
