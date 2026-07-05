import React from "react";
import { MangaPage } from "../types";
import { Plus, Trash2, Loader, BookOpen, AlertCircle, FileImage, Sparkles } from "lucide-react";

interface PageListProps {
  pages: MangaPage[];
  activePageId: string | null;
  onSelectPage: (id: string) => void;
  onDeletePage: (id: string) => void;
  onTriggerUpload: () => void;
  onLoadDemo: () => void;
}

export default function PageList({
  pages,
  activePageId,
  onSelectPage,
  onDeletePage,
  onTriggerUpload,
  onLoadDemo,
}: PageListProps) {
  return (
    <div id="page-list-container" className="flex flex-col h-full bg-[#0E0E11] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
      
      {/* Sidebar Header */}
      <div className="px-6 py-4 bg-[#111114] border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-[#E4E4E7]">Manga Pages</h3>
        </div>
        <span className="bg-white/5 text-white/60 border border-white/10 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
          Pages: {pages.length}
        </span>
      </div>

      {/* Sheet collection stack */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[82vh]">
        {pages.map((p, idx) => {
          const isActive = activePageId === p.id;
          
          return (
            <div
              key={p.id}
              id={`page-card-${p.id}`}
              onClick={() => onSelectPage(p.id)}
              className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? "border-indigo-500 bg-[#1A1A1E] shadow-lg shadow-indigo-950/20"
                  : "border-white/5 bg-[#111114]/40 hover:bg-white/5 hover:border-white/10"
              }`}
            >
              {/* Thumbnail representation */}
              <div className="relative w-14 h-20 bg-zinc-900 rounded-md border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src={p.url}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {/* Status Badges Overlaid */}
                {p.status === "analyzing" && (
                  <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                    <Loader className="h-4 w-4 text-indigo-400 animate-spin" />
                  </div>
                )}
                {p.status === "error" && (
                  <div className="absolute inset-0 bg-red-950/75 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  </div>
                )}
              </div>

              {/* Information Row */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <p className="text-xs font-semibold text-[#E4E4E7] truncate" title={p.name}>
                    Page {idx + 1}
                  </p>
                  <button
                    id={`delete-page-btn-${p.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePage(p.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                    title="Remove active page"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <p className="text-[10px] text-white/40 truncate mb-1.5" title={p.name}>
                  {p.name}
                </p>

                {/* Foot indicators */}
                <div className="flex items-center gap-1.5">
                  {p.status === "analyzing" ? (
                    <span className="text-[9px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse">
                      Segmenting AI...
                    </span>
                  ) : p.status === "error" ? (
                    <span className="text-[9px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5" title={p.error || "Process failed"}>
                      Failed
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {p.panels.length} panels
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Quick action helper buttons inside stack */}
        <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
          <button
            id={`trigger-main-file-upload`}
            onClick={onTriggerUpload}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-indigo-900/20"
          >
            <Plus className="h-4 w-4" />
            Upload New Page
          </button>
          
          <button
            id={`load-demo-page-sidebar`}
            onClick={onLoadDemo}
            className="w-full py-2 bg-[#1A1A1E] border border-white/5 hover:border-white/15 text-white/80 hover:bg-[#25252b] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
            Add Manga Demo
          </button>
        </div>
      </div>
    </div>
  );
}
