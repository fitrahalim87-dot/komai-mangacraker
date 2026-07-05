import React, { useState } from "react";
import { MangaPanel } from "../types";
import { ArrowUp, ArrowDown, Download, Trash2, Edit2, Check, HelpCircle, FileImage, Image as ImageIcon } from "lucide-react";

interface PanelListItem {
  pageId: string;
  pageName: string;
  panel: MangaPanel;
  absoluteIndex: number; // 1-based sequential counter across all pages
}

interface PanelLibraryProps {
  panels: PanelListItem[];
  selectedPanelId: string | null;
  onSelectPanel: (panelId: string, pageId: string) => void;
  onDeletePanel: (pageId: string, panelId: string) => void;
  onUpdateDescription: (pageId: string, panelId: string, text: string) => void;
  onReorder: (direction: "up" | "down", index: number) => void;
  onHoverPanel: (panelId: string | null) => void;
  onDownloadSingle: (panel: MangaPanel, filename: string) => void;
  onDownloadAll: () => void;
  isZipping: boolean;
}

export default function PanelLibrary({
  panels,
  selectedPanelId,
  onSelectPanel,
  onDeletePanel,
  onUpdateDescription,
  onReorder,
  onHoverPanel,
  onDownloadSingle,
  onDownloadAll,
  isZipping,
}: PanelLibraryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleStartEdit = (panelId: string, desc: string) => {
    setEditingId(panelId);
    setEditText(desc);
  };

  const handleSaveEdit = (pageId: string, panelId: string) => {
    onUpdateDescription(pageId, panelId, editText);
    setEditingId(null);
  };

  return (
    <div id="panel-library-container" className="flex flex-col h-full bg-[#0E0E11] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
      {/* Title Header */}
      <div className="px-6 py-4 bg-[#111114] border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-[#E4E4E7]">Extracted Panels</h3>
        </div>
        <span className="px-2 py-0.5 bg-white/5 text-white/60 border border-white/10 font-mono text-[10px] font-bold rounded-full">
          Total: {panels.length}
        </span>
      </div>

      {/* Quick Download Actions Bar */}
      {panels.length > 0 && (
        <div className="px-6 py-2.5 bg-[#17171e] border-b border-white/5 flex items-center justify-between text-xs transition duration-150">
          <span className="text-white/45 font-mono text-[10px] tracking-wider uppercase font-semibold">Sequential ZIP Pack</span>
          <button
            id="panel-library-download-all-btn"
            onClick={onDownloadAll}
            disabled={isZipping}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-white/30 text-white font-bold text-xs rounded transition flex items-center gap-1 cursor-pointer select-none"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            {isZipping ? "Creating ZIP..." : "Download All (.ZIP)"}
          </button>
        </div>
      )}

      {/* Panel Stack Content list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[82vh]">
        {panels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="p-3 bg-[#111114] rounded-full mb-3 text-white/30 border border-white/5 animate-pulse">
              <FileImage className="h-8 w-8 text-indigo-400/80" />
            </div>
            <p className="text-sm font-semibold text-[#E4E4E7]">No panels segmented yet</p>
            <p className="text-xs text-white/40 mt-1.5 max-w-[200px] leading-relaxed">
              Upload manga images or try our interactive demo to start auto-generating crops.
            </p>
          </div>
        ) : (
          panels.map(({ pageId, pageName, panel, absoluteIndex }, idx) => {
            const isSelected = selectedPanelId === panel.id;
            const filename = `panel_${String(absoluteIndex).padStart(3, "0")}.jpg`;

            return (
              <div
                key={panel.id}
                id={`panel-card-${panel.id}`}
                onMouseEnter={() => onHoverPanel(panel.id)}
                onMouseLeave={() => onHoverPanel(null)}
                onClick={() => onSelectPanel(panel.id, pageId)}
                className={`flex flex-col p-3 rounded-xl border transition-all duration-150 ${
                  isSelected
                    ? "border-indigo-500 bg-[#1A1A1E] shadow-lg shadow-indigo-950/20"
                    : "border-white/5 bg-[#111114]/40 hover:bg-white/5 hover:border-white/10"
                }`}
              >
                {/* File Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-indigo-450 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                      {filename}
                    </span>
                    <span className="text-[10px] text-white/40 truncate max-w-[90px]" title={pageName}>
                      {pageName}
                    </span>
                  </div>

                  {/* Ordering pushes */}
                  <div className="flex items-center gap-1 opacity-85 group-hover:opacity-100">
                    <button
                      id={`bubble-up-${panel.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorder("up", idx);
                      }}
                      disabled={idx === 0}
                      className="p-1 text-white/40 hover:text-white disabled:opacity-20 hover:bg-white/5 rounded cursor-pointer"
                      title="Move Up (Adjust Reading Order)"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      id={`bubble-down-${panel.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorder("down", idx);
                      }}
                      disabled={idx === panels.length - 1}
                      className="p-1 text-white/40 hover:text-white disabled:opacity-20 hover:bg-white/5 rounded cursor-pointer"
                      title="Move Down (Adjust Reading Order)"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Thumbnail & Description block */}
                <div className="flex gap-3">
                  {/* Image Crop Thumbnail */}
                  <div className="relative w-18 h-18 bg-[#050505] rounded-lg border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                    {panel.croppedUrl ? (
                      <img
                        src={panel.croppedUrl}
                        alt="panel preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-white/20 animate-pulse" />
                    )}
                    <span className="absolute bottom-0 inset-x-0 bg-black/75 text-white font-mono text-[8px] text-center py-0.5 font-bold">
                      #{panel.reading_order_level}
                    </span>
                  </div>

                  {/* Info Column */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-block text-[9px] font-bold tracking-wider uppercase text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">
                          {panel.position_name || "Pane Segment"}
                        </span>
                        <span className="text-[9px] font-mono text-white/30 shrink-0">
                          [{panel.box_2d.join(",")}]
                        </span>
                      </div>

                      {/* Decription block */}
                      {editingId === panel.id ? (
                        <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(pageId, panel.id);
                            }}
                            className="flex-1 text-xs border border-white/15 rounded-md px-2 py-1 bg-[#1A1A1E] text-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(pageId, panel.id)}
                            className="p-1 bg-indigo-600 hover:bg-indigo-505 text-white rounded-md transition cursor-pointer"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="text-xs text-white/55 line-clamp-2 leading-snug font-normal flex items-start gap-1 p-0.5"
                        >
                          <span className="flex-1">{panel.description || "No visual annotation recorded."}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(panel.id, panel.description);
                            }}
                            className="p-1 text-white/35 hover:text-indigo-400 hover:bg-white/5 rounded transition cursor-pointer shrink-0"
                            title="Edit description annotation"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Operational download / delete panel level */}
                    <div className="flex items-center justify-end gap-1.5 mt-2 pt-1.5 border-t border-white/5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadSingle(panel, filename);
                        }}
                        disabled={!panel.croppedUrl}
                        className="p-1 px-2 bg-[#1A1A1E] border border-white/5 hover:bg-[#25252b] hover:border-white/15 text-white/80 disabled:opacity-30 rounded-md flex items-center gap-1 text-[10px] font-semibold transition cursor-pointer"
                        title="Download crops jpeg"
                      >
                        <Download className="h-3 w-3 text-indigo-405" />
                        Download
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePanel(pageId, panel.id);
                        }}
                        className="p-1 text-rose-450 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                        title="Delete pane"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
