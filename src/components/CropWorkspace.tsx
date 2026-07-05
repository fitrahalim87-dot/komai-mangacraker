import React, { useRef, useState, useEffect } from "react";
import { MangaPage, MangaPanel } from "../types";
import { cropMangaPanel } from "../utils";
import { AnimatePresence } from "motion/react";
import { 
  Move, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Scissors, 
  ChevronRight, 
  ChevronLeft, 
  Lock, 
  Unlock, 
  Sliders, 
  Grid,
  ChevronUp, 
  ChevronDown, 
  Eye, 
  EyeOff,
  Split
} from "lucide-react";

interface CropWorkspaceProps {
  page: MangaPage;
  selectedPanelId: string | null;
  onSelectPanel: (id: string | null) => void;
  onUpdatePanels: (panels: MangaPanel[]) => void;
  onReAnalyze: () => void;
  hoveredPanelId: string | null;
  
  // Requirement 1: Pagination
  onPrevPage: () => void;
  onNextPage: () => void;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  pageIndex: number;
  totalPages: number;

  // Requirement 2: AI Autodetect disable
  isAiEnabled: boolean;
  onToggleAi: (val: boolean) => void;
}

type DragMode = "move" | "nw" | "ne" | "se" | "sw" | "draw" | null;

export default function CropWorkspace({
  page,
  selectedPanelId,
  onSelectPanel,
  onUpdatePanels,
  onReAnalyze,
  hoveredPanelId,
  onPrevPage,
  onNextPage,
  hasPrevPage,
  hasNextPage,
  pageIndex,
  totalPages,
  isAiEnabled,
  onToggleAi,
}: CropWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<"select" | "draw" | "split">("split");
  const [splitOrientation, setSplitOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [placedCuts, setPlacedCuts] = useState<{ id: string; type: "horizontal" | "vertical"; coord: number }[]>([]);

  // Reset placed cuts when page changes
  useEffect(() => {
    setPlacedCuts([]);
  }, [page.id]);
  
  const [dragState, setDragState] = useState<{
    mode: DragMode;
    panelId: string;
    startX: number;
    startY: number;
    startBox: [number, number, number, number];
  } | null>(null);

  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [tempBox, setTempBox] = useState<[number, number, number, number] | null>(null);

  // Mobile states
  const [showCoordinateDrawer, setShowCoordinateDrawer] = useState<boolean>(false);

  // Global listeners for pointer drag and resizing (mobile-touch compatible)
  useEffect(() => {
    if (!dragState) return;

    let hasPassedThreshold = false;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      const pixelDiffX = Math.abs(e.clientX - dragState.startX);
      const pixelDiffY = Math.abs(e.clientY - dragState.startY);

      if (!hasPassedThreshold) {
        if (pixelDiffX > 8 || pixelDiffY > 8) {
          hasPassedThreshold = true;
        } else {
          return; 
        }
      }
      
      const deltaX = ((e.clientX - dragState.startX) / rect.width) * 1000;
      const deltaY = ((e.clientY - dragState.startY) / rect.height) * 1000;

      const [y1, x1, y2, x2] = dragState.startBox;
      let newBox: [number, number, number, number] = [dragState.startBox[0], dragState.startBox[1], dragState.startBox[2], dragState.startBox[3]];

      if (dragState.mode === "move") {
        const h = y2 - y1;
        const w = x2 - x1;
        let newY1 = Math.max(0, Math.min(1000 - h, y1 + deltaY));
        let newX1 = Math.max(0, Math.min(1000 - w, x1 + deltaX));
        newBox = [newY1, newX1, newY1 + h, newX1 + w];
      } else if (dragState.mode === "se") {
        const newY2 = Math.max(y1 + 15, Math.min(1000, y2 + deltaY));
        const newX2 = Math.max(x1 + 15, Math.min(1000, x2 + deltaX));
        newBox = [y1, x1, newY2, newX2];
      } else if (dragState.mode === "nw") {
        const newY1 = Math.max(0, Math.min(y2 - 15, y1 + deltaY));
        const newX1 = Math.max(0, Math.min(x2 - 15, x1 + deltaX));
        newBox = [newY1, newX1, y2, x2];
      } else if (dragState.mode === "ne") {
        const newY1 = Math.max(0, Math.min(y2 - 15, y1 + deltaY));
        const newX2 = Math.max(x1 + 15, Math.min(1000, x2 + deltaX));
        newBox = [newY1, x1, y2, newX2];
      } else if (dragState.mode === "sw") {
        const newY2 = Math.max(y1 + 15, Math.min(1000, y2 + deltaY));
        const newX1 = Math.max(0, Math.min(x2 - 15, x1 + deltaX));
        newBox = [y1, newX1, newY2, x2];
      }

      const roundedBox = newBox.map(v => Math.round(v)) as [number, number, number, number];

      const updated = page.panels.map(p => {
        if (p.id === dragState.panelId) {
          return { ...p, box_2d: roundedBox };
        }
        return p;
      });
      onUpdatePanels(updated);
    };

    const handlePointerUp = async () => {
      if (!dragState) return;
      const targetPanel = page.panels.find(p => p.id === dragState.panelId);
      if (targetPanel) {
        try {
          const cropped = await cropMangaPanel(page.url, targetPanel.box_2d);
          const updated = page.panels.map(p => {
            if (p.id === targetPanel.id) {
              return { ...p, croppedUrl: cropped };
            }
            return p;
          });
          onUpdatePanels(updated);
        } catch (e) {
          console.error("Cropping update failed", e);
        }
      }
      setDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, page, onUpdatePanels]);

  // Helper to find which panel contains coordinates (x, y)
  const findTargetPanelAt = (x: number, y: number) => {
    let target: MangaPanel | null = null;
    let minArea = Infinity;
    for (const p of page.panels) {
      const [ymin, xmin, ymax, xmax] = p.box_2d;
      if (y >= ymin && y <= ymax && x >= xmin && x <= xmax) {
        const area = (ymax - ymin) * (xmax - xmin);
        if (area < minArea) {
          minArea = area;
          target = p;
        }
      }
    }
    return target;
  };

  // Reset Cuts handler: Clears all custom cut lines and resets to a single page-spanning box
  const handleResetCuts = async () => {
    setPlacedCuts([]);
    const fullPageBox: [number, number, number, number] = [0, 0, 1000, 1000];
    let croppedUrl: string | null = null;
    try {
      croppedUrl = await cropMangaPanel(page.url, fullPageBox);
    } catch (err) {
      console.error("Full page crop failed", err);
    }
    const defaultPanel: MangaPanel = {
      id: `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      box_2d: fullPageBox,
      description: "Halaman Utuh",
      position_name: "Page Span",
      reading_order_level: 1,
      croppedUrl
    };
    onUpdatePanels([defaultPanel]);
    onSelectPanel(defaultPanel.id);
  };

  // Requirement 3: Click-to-split handler (global slice-cut logic)
  const handleSplitClick = async (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1000, ((e.clientX - rect.left) / rect.width) * 1000));
    const y = Math.max(0, Math.min(1000, ((e.clientY - rect.top) / rect.height) * 1000));

    // Ensure we have at least one panel to split
    let currentPanels = page.panels;
    if (currentPanels.length === 0) {
      const fullPageBox: [number, number, number, number] = [0, 0, 1000, 1000];
      let croppedUrl: string | null = null;
      try {
        croppedUrl = await cropMangaPanel(page.url, fullPageBox);
      } catch (err) {
        console.error("Full page crop failed", err);
      }
      currentPanels = [{
        id: `full_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        box_2d: fullPageBox,
        description: "Halaman Utuh",
        position_name: "Page Span",
        reading_order_level: 1,
        croppedUrl
      }];
    }

    const splitCoord = Math.round(splitOrientation === "horizontal" ? y : x);
    let didSplitAny = false;

    // Define structure for concurrent cropping tasks
    interface CropTask {
      id: string;
      box: [number, number, number, number];
      description: string;
      positionName: string;
      readingOrderLevel: number;
    }
    const cropTasks: CropTask[] = [];
    const nextPanelsList: MangaPanel[] = [];

    for (const p of currentPanels) {
      const [ymin, xmin, ymax, xmax] = p.box_2d;

      if (splitOrientation === "horizontal") {
        if (splitCoord > ymin + 15 && splitCoord < ymax - 15) {
          didSplitAny = true;
          const boxA: [number, number, number, number] = [ymin, xmin, splitCoord, xmax];
          const boxB: [number, number, number, number] = [splitCoord, xmin, ymax, xmax];

          const idA = `split_${Date.now()}_a_${Math.random().toString(36).substr(2, 4)}`;
          const idB = `split_${Date.now()}_b_${Math.random().toString(36).substr(2, 4)}`;

          cropTasks.push({
            id: idA,
            box: boxA,
            description: "Bagian Atas",
            positionName: "Split Segment",
            readingOrderLevel: p.reading_order_level,
          });

          cropTasks.push({
            id: idB,
            box: boxB,
            description: "Bagian Bawah",
            positionName: "Split Segment",
            readingOrderLevel: p.reading_order_level + 0.5,
          });
        } else {
          nextPanelsList.push(p);
        }
      } else {
        // vertical split
        if (splitCoord > xmin + 15 && splitCoord < xmax - 15) {
          didSplitAny = true;
          const boxA: [number, number, number, number] = [ymin, xmin, ymax, splitCoord];
          const boxB: [number, number, number, number] = [ymin, splitCoord, ymax, xmax];

          const idA = `split_${Date.now()}_a_${Math.random().toString(36).substr(2, 4)}`;
          const idB = `split_${Date.now()}_b_${Math.random().toString(36).substr(2, 4)}`;

          cropTasks.push({
            id: idA,
            box: boxA,
            description: "Bagian Kiri",
            positionName: "Split Segment",
            readingOrderLevel: p.reading_order_level,
          });

          cropTasks.push({
            id: idB,
            box: boxB,
            description: "Bagian Kanan",
            positionName: "Split Segment",
            readingOrderLevel: p.reading_order_level + 0.5,
          });
        } else {
          nextPanelsList.push(p);
        }
      }
    }

    if (!didSplitAny) return;

    // Trigger crops concurrently
    const croppedResults = await Promise.all(
      cropTasks.map(async (task) => {
        let croppedUrl: string | null = null;
        try {
          croppedUrl = await cropMangaPanel(page.url, task.box);
        } catch (err) {
          console.error("Split crop failed", err);
        }
        return {
          id: task.id,
          box_2d: task.box,
          description: task.description,
          position_name: task.positionName,
          reading_order_level: task.readingOrderLevel,
          croppedUrl,
        };
      })
    );

    const combined = [...nextPanelsList, ...croppedResults];
    const sorted = combined.sort((a, b) => a.reading_order_level - b.reading_order_level);
    const reindexed = sorted.map((p, idx) => ({
      ...p,
      reading_order_level: idx + 1,
    }));

    onUpdatePanels(reindexed);

    // Find first split panel to select
    const firstSplit = reindexed.find(p => p.id.includes("_a_") || p.id.includes("_b_"));
    if (firstSplit) {
      onSelectPanel(firstSplit.id);
    }

    // Add persistent cut line for full page rendering
    setPlacedCuts(prev => {
      const isDuplicate = prev.some(c => c.type === splitOrientation && Math.abs(c.coord - splitCoord) < 2);
      if (isDuplicate) return prev;
      return [
        ...prev,
        {
          id: `cut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: splitOrientation,
          coord: splitCoord,
        }
      ];
    });
  };

  const handleBgMouseDown = async (e: React.PointerEvent) => {
    if (tool === "split") {
      await handleSplitClick(e);
      return;
    }
    if (tool !== "draw" || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;

    setDrawStart({ x, y });
    setTempBox([y, x, y, x]);
  };

  const handleBgMouseMove = (e: React.PointerEvent) => {
    if (!drawStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1000, ((e.clientX - rect.left) / rect.width) * 1000));
    const y = Math.max(0, Math.min(1000, ((e.clientY - rect.top) / rect.height) * 1000));

    setTempBox([
      Math.min(drawStart.y, y),
      Math.min(drawStart.x, x),
      Math.max(drawStart.y, y),
      Math.max(drawStart.x, x),
    ]);
  };

  const handleBgMouseMoveExtended = (e: React.PointerEvent) => {
    if (tool === "split") {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1000, ((e.clientX - rect.left) / rect.width) * 1000));
      const y = Math.max(0, Math.min(1000, ((e.clientY - rect.top) / rect.height) * 1000));
      setHoverCoord({ x, y });
    } else {
      handleBgMouseMove(e);
    }
  };

  const handleBgMouseUp = async () => {
    if (!drawStart || !tempBox) return;

    const width = tempBox[3] - tempBox[1];
    const height = tempBox[2] - tempBox[0];

    if (width > 12 && height > 12) {
      const roundedBox = tempBox.map(v => Math.round(v)) as [number, number, number, number];
      
      const newPanelId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let croppedUrl: string | null = null;
      try {
        croppedUrl = await cropMangaPanel(page.url, roundedBox);
      } catch (e) {
        console.error(e);
      }

      const nextOrder = page.panels.length + 1;
      const newPanel: MangaPanel = {
        id: newPanelId,
        box_2d: roundedBox,
        description: `Custom manual frame crop index #${nextOrder}`,
        position_name: "Manual Crop",
        reading_order_level: nextOrder,
        croppedUrl
      };

      onUpdatePanels([...page.panels, newPanel]);
      onSelectPanel(newPanelId);
    }

    setDrawStart(null);
    setTempBox(null);
    setTool("select");
  };

  const startDrag = (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>, panelId: string, mode: DragMode) => {
    if (!isManualMode) return;
    e.stopPropagation();
    e.preventDefault(); 
    const panel = page.panels.find(p => p.id === panelId);
    if (!panel) return;

    onSelectPanel(panelId);
    setDragState({
      mode,
      panelId,
      startX: e.clientX,
      startY: e.clientY,
      startBox: [...panel.box_2d],
    });
  };

  const handleDeletePanel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = page.panels.filter(p => p.id !== id);
    const reordered = updated.map((p, idx) => ({
      ...p,
      reading_order_level: idx + 1
    }));
    onUpdatePanels(reordered);
    if (selectedPanelId === id) {
      onSelectPanel(null);
    }
  };

  const handleCreateDefaultBox = async () => {
    const newBox: [number, number, number, number] = [380, 380, 620, 620];
    const newId = `manual_${Date.now()}`;
    let cropped = null;
    try {
      cropped = await cropMangaPanel(page.url, newBox);
    } catch(e){}

    const newPanel: MangaPanel = {
      id: newId,
      box_2d: newBox,
      description: "Manually spawned center box",
      position_name: "Center Plot",
      reading_order_level: page.panels.length + 1,
      croppedUrl: cropped
    };

    onUpdatePanels([...page.panels, newPanel]);
    onSelectPanel(newId);
    setShowCoordinateDrawer(true);
  };

  const selectedPanel = page.panels.find(p => p.id === selectedPanelId) || null;

  const handleManualCoordChange = async (index: number, newValue: number) => {
    if (!selectedPanel) return;

    const newBox = [
      selectedPanel.box_2d[0],
      selectedPanel.box_2d[1],
      selectedPanel.box_2d[2],
      selectedPanel.box_2d[3]
    ] as [number, number, number, number];

    newBox[index] = Math.max(0, Math.min(1000, newValue));

    if (index === 0 && newBox[2] - newBox[0] < 12) {
      newBox[2] = Math.min(1000, newBox[0] + 12);
    }
    if (index === 1 && newBox[3] - newBox[1] < 12) {
      newBox[3] = Math.min(1000, newBox[1] + 12);
    }
    if (index === 2 && newBox[2] - newBox[0] < 12) {
      newBox[0] = Math.max(0, newBox[2] - 12);
    }
    if (index === 3 && newBox[3] - newBox[1] < 12) {
      newBox[1] = Math.max(0, newBox[3] - 12);
    }

    const roundedBox = newBox.map(v => Math.round(v)) as [number, number, number, number];

    const updated = page.panels.map(p => {
      if (p.id === selectedPanel.id) {
        return { ...p, box_2d: roundedBox };
      }
      return p;
    });
    onUpdatePanels(updated);

    try {
      const cropped = await cropMangaPanel(page.url, roundedBox);
      const withCrop = page.panels.map(p => {
        if (p.id === selectedPanel.id) {
          return { ...p, box_2d: roundedBox, croppedUrl: cropped };
        }
        return p;
      });
      onUpdatePanels(withCrop);
    } catch (err) {
      console.error(err);
    }
  };

  // Hover divider preview calculations
  let lineStyle: React.CSSProperties = {};
  let hasPreviewLine = false;

  if (tool === "split" && hoverCoord) {
    if (splitOrientation === "horizontal") {
      lineStyle = {
        top: `${hoverCoord.y / 10}%`,
        left: "0%",
        width: "100%",
        height: "0px"
      };
    } else {
      lineStyle = {
        left: `${hoverCoord.x / 10}%`,
        top: "0%",
        height: "100%",
        width: "0px"
      };
    }
    hasPreviewLine = true;
  }

  return (
    <div id="crop-workspace-container" className="flex-1 flex flex-col relative w-full h-full bg-[#030303] overflow-hidden select-none">
      
      {/* Sleek Pagination & AI Control Header Bar (Requirement 1 & 2) */}
      <div className="w-full bg-[#0d0d12]/95 border-b border-white/5 px-4 py-3 flex items-center justify-between shrink-0 select-none z-30 backdrop-blur-md">
        {/* Left Side: Page indicator and Next/Prev buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevPage}
            disabled={!hasPrevPage}
            className="p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-white/5 transition cursor-pointer"
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <div className="text-left leading-none px-1.5">
            <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-white/40 block">Halaman Lab</span>
            <span className="text-xs font-black text-white truncate max-w-[140px] block mt-0.5">
              {page.name || "Manga Sheet"} <span className="text-indigo-400 font-mono">({pageIndex + 1}/{totalPages})</span>
            </span>
          </div>

          <button
            onClick={onNextPage}
            disabled={!hasNextPage}
            className="p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-white/5 transition cursor-pointer"
            title="Halaman Selanjutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Center: Reset Cuts Button when in split mode */}
        {tool === "split" && (
          <button
            onClick={handleResetCuts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-300 text-xs font-bold transition cursor-pointer shadow-lg shadow-rose-950/20"
            title="Reset Semua Potongan Garis"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Reset Potongan</span>
          </button>
        )}

        {/* Right Side: AI Status and Switch Toggle */}
        <div className="flex items-center gap-2 bg-black/40 px-2.5 py-1 rounded-xl border border-white/5">
          <div className="text-right leading-none pr-1">
            <span className="text-[9px] uppercase font-mono tracking-widest text-indigo-400 block font-black">AI Deteksi</span>
            <span className={`text-[9px] font-extrabold ${isAiEnabled ? "text-green-400" : "text-rose-400"}`}>
              {isAiEnabled ? "AKTIF" : "OFF"}
            </span>
          </div>
          <button
            onClick={() => onToggleAi(!isAiEnabled)}
            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer flex items-center ${
              isAiEnabled ? "bg-indigo-600 justify-end" : "bg-zinc-800 justify-start"
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-md transform duration-200" />
          </button>
        </div>
      </div>

      {/* SCROLLABLE VIEWPORT CONTAINER HOLDING CANVAS, CONTROLS, AND THE PREVIEWS UNDERNEATH */}
      <div className="flex-1 w-full relative overflow-hidden bg-[#040406]">
        
        {/* Scrollable Main Area */}
        <div className="absolute inset-0 overflow-y-auto scrollbar-thin flex flex-col">
          
          {/* 2D CANVAS CONTAINER occupies space nicely */}
          <div className="w-full flex flex-col items-center justify-center p-3 sm:p-5 relative select-none">
            
            {/* Help indicators on lock mode */}
            <div className="absolute top-3 left-3 z-30 bg-black/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/5 pointer-events-none text-[10px] text-white/80 font-medium flex items-center gap-1 shadow-lg max-w-[85%]">
              {!isManualMode && tool !== "split" ? (
                <>
                  <Lock className="h-3 w-3 text-amber-500 animate-pulse" />
                  <span>Kotak Terkunci 🔒 Seret tidak sengaja dicegah!</span>
                </>
              ) : tool === "select" ? (
                <>
                  <Move className="h-3 w-3 text-indigo-400" />
                  <span>Gunakan manual koordinat / seret tepi kotak.</span>
                </>
              ) : tool === "draw" ? (
                <>
                  <Scissors className="h-3 w-3 text-teal-400" />
                  <span>Seret pada layar untuk memahat panel baru.</span>
                </>
              ) : (
                <>
                  <Split className="h-3.5 w-3.5 text-indigo-400 animate-pulse shrink-0" />
                  <span>Klik gambar untuk membagi panel dengan garis pembelah ({splitOrientation === "horizontal" ? "Mendatar ▬" : "Tegak ▮"}).</span>
                </>
              )}
            </div>

            <div className="w-full flex items-center justify-center relative my-4">
              {/* Interactive Responsive Viewport */}
              <div
                ref={containerRef}
                onPointerDown={handleBgMouseDown}
                onPointerMove={handleBgMouseMoveExtended}
                onPointerUp={handleBgMouseUp}
                onPointerLeave={() => setHoverCoord(null)}
                className={`relative max-w-full max-h-[85vh] select-none shadow-2xl border border-white/10 rounded-2xl overflow-hidden bg-zinc-900 transition-all duration-150 ${
                  tool === "draw" || tool === "split" ? "cursor-crosshair touch-none" : "cursor-default"
                }`}
                style={{ aspectRatio: `${page.width || 800} / ${page.height || 1100}` }}
              >
                {/* Base Manga sheet representation */}
                <img
                  src={page.url}
                  alt="Manga Workspace page"
                  className="w-full h-full object-contain pointer-events-none select-none"
                  referrerPolicy="no-referrer"
                />

                {/* Interactive Bounding box segments */}
                {page.panels.map((panel) => {
                  const [ymin, xmin, ymax, xmax] = panel.box_2d;
                  const top = `${ymin / 10}%`;
                  const left = `${xmin / 10}%`;
                  const height = `${(ymax - ymin) / 10}%`;
                  const width = `${(xmax - xmin) / 10}%`;

                  const isSelected = selectedPanelId === panel.id;
                  const isHovered = hoveredPanelId === panel.id;

                  return (
                    <div
                      key={panel.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPanel(panel.id);
                      }}
                      className={`absolute transition-all duration-100 touch-none ${
                        isSelected
                          ? "border-2 border-indigo-500 bg-indigo-500/10 shadow-xl ring-2 ring-indigo-500/30 z-20"
                          : isHovered
                          ? "border border-indigo-400 bg-indigo-400/5 ring-1 ring-indigo-400/20 z-15"
                          : "border border-indigo-600/70 bg-black/5 hover:border-indigo-400 hover:bg-indigo-400/5 z-10"
                      }`}
                      style={{ top, left, height, width }}
                    >
                      {/* Drag handle block */}
                      <div
                        onPointerDown={(e) => startDrag(e, panel.id, "move")}
                        className={`absolute inset-0 ${isManualMode ? "cursor-move" : "cursor-pointer"} touch-none`}
                      />

                      {/* Index sequential ordering label */}
                      <div
                        className={`absolute top-1 right-1 flex items-center justify-center rounded font-mono text-[9px] font-bold px-1.5 py-0.5 shadow-md text-white ${
                          isSelected ? "bg-indigo-600" : "bg-[#111114]/90 border border-white/5"
                        }`}
                      >
                        {String(panel.reading_order_level).padStart(3, "0")}
                      </div>

                      {/* Trash delete FAB directly inside segment frame */}
                      {isManualMode && (
                        <button
                          onClick={(e) => handleDeletePanel(panel.id, e)}
                          className="absolute bottom-1 right-1 p-1 bg-black/80 border border-white/15 text-rose-400 active:bg-rose-600 active:text-white rounded-md cursor-pointer transition shadow-xl z-25"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      )}

                      {/* Material Resizing edges anchors */}
                      {isSelected && isManualMode && (
                        <>
                          {/* Top-Left */}
                          <div
                            onPointerDown={(e) => startDrag(e, panel.id, "nw")}
                            className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border border-indigo-500 rounded-full cursor-nwse-resize z-30 shadow touch-none"
                          />
                          {/* Top-Right */}
                          <div
                            onPointerDown={(e) => startDrag(e, panel.id, "ne")}
                            className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border border-indigo-500 rounded-full cursor-nesw-resize z-30 shadow touch-none"
                          />
                          {/* Bottom-Left */}
                          <div
                            onPointerDown={(e) => startDrag(e, panel.id, "sw")}
                            className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border border-indigo-500 rounded-full cursor-nesw-resize z-30 shadow touch-none"
                          />
                          {/* Bottom-Right */}
                          <div
                            onPointerDown={(e) => startDrag(e, panel.id, "se")}
                            className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border border-indigo-500 rounded-full cursor-nwse-resize z-30 shadow touch-none"
                          />
                        </>
                      )}
                    </div>
                  );
                })}

                {/* New Drag Draw custom boundary previews feedback */}
                {tempBox && (
                  <div
                    className="absolute border border-teal-400 border-dashed bg-teal-400/10 pointer-events-none z-30"
                    style={{
                      top: `${tempBox[0] / 10}%`,
                      left: `${tempBox[1] / 10}%`,
                      height: `${(tempBox[2] - tempBox[0]) / 10}%`,
                      width: `${(tempBox[3] - tempBox[1]) / 10}%`,
                    }}
                  />
                )}

                {/* Persistent placed cut lines */}
                {placedCuts.map((cut) => {
                  const isHoriz = cut.type === "horizontal";
                  const cutLineStyle: React.CSSProperties = isHoriz
                    ? {
                        top: `${cut.coord / 10}%`,
                        left: "0%",
                        width: "100%",
                        height: "0px",
                        borderTop: "2.5px dashed #ea580c",
                        boxShadow: "0 0 6px rgba(234, 88, 12, 0.5)",
                      }
                    : {
                        left: `${cut.coord / 10}%`,
                        top: "0%",
                        height: "100%",
                        width: "0px",
                        borderLeft: "2.5px dashed #ea580c",
                        boxShadow: "0 0 6px rgba(234, 88, 12, 0.5)",
                      };
                  return (
                    <div
                      key={cut.id}
                      className="absolute z-35 pointer-events-none"
                      style={cutLineStyle}
                    />
                  );
                })}

                {/* Glowing dashed divider preview line for click splitting */}
                {hasPreviewLine && (
                  <div 
                    className="absolute z-40 pointer-events-none"
                    style={{
                      ...lineStyle,
                      borderTop: splitOrientation === "horizontal" ? "2px dashed #ea580c" : "none",
                      borderLeft: splitOrientation === "vertical" ? "2px dashed #ea580c" : "none",
                      boxShadow: "0 0 8px rgba(234, 88, 12, 0.6)",
                    }}
                  />
                )}

              </div>
            </div>

          </div>

          {/* Sleek Bottom Control Bar */}
          <div className="w-full bg-[#0d0d12]/95 border-y border-white/5 p-2 flex flex-col md:flex-row items-center justify-between gap-2 shrink-0 select-none sticky top-0 z-30 backdrop-blur-md">
            {/* Left Section: Active Tool Segments */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-center md:justify-start">
              <div className="flex bg-zinc-900 border border-white/10 p-0.5 rounded-lg gap-0.5">
                <button
                  onClick={() => { setTool("split"); }}
                  className={`py-1 px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                    tool === "split"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/30"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Split className="h-3 w-3" />
                  <span>Garis Pembelah</span>
                </button>

            <button
              onClick={() => { setTool("draw"); }}
              className={`py-1 px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                tool === "draw"
                  ? "bg-teal-600 text-white shadow-md shadow-teal-950/30"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Scissors className="h-3 w-3" />
              <span>Gunting Seri</span>
            </button>

            <button
              onClick={() => { setTool("select"); setDrawStart(null); }}
              className={`py-1 px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                tool === "select"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-950/30"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Move className="h-3 w-3" />
              <span>Geser Kotak</span>
            </button>
          </div>

          {/* If Split is active, show the orientation directly next to it */}
          {tool === "split" && (
            <div className="flex bg-zinc-900 border border-white/10 p-0.5 rounded-lg gap-0.5">
              <button
                onClick={() => setSplitOrientation("horizontal")}
                className={`py-1 px-2 rounded-md text-[10px] font-bold transition cursor-pointer ${
                  splitOrientation === "horizontal"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                Mendatar ▬
              </button>
              <button
                onClick={() => setSplitOrientation("vertical")}
                className={`py-1 px-2 rounded-md text-[10px] font-bold transition cursor-pointer ${
                  splitOrientation === "vertical"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                Tegak ▮
              </button>
            </div>
          )}
        </div>

        {/* Right Section: Utility actions & settings toggles */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-center md:justify-end">
          {/* Create custom frame manually */}
          <button
            onClick={handleCreateDefaultBox}
            className="py-1 px-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg text-[11px] font-bold text-white flex items-center gap-1 transition cursor-pointer active:scale-95"
          >
            <Plus className="h-3 w-3 text-white/60" />
            <span>Tambah Kotak</span>
          </button>

          {/* Reset cut lines button (only in split mode) */}
          {tool === "split" && (
            <button
              onClick={handleResetCuts}
              className="py-1 px-2 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
              title="Reset Semua Potongan Garis"
            >
              <Trash2 className="h-3 w-3" />
              <span>Reset Potongan</span>
            </button>
          )}

          {/* Lock/Unlock Toggle */}
          <button
            onClick={() => setIsManualMode(!isManualMode)}
            className={`py-1 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition border cursor-pointer active:scale-95 ${
              isManualMode
                ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-600/30"
                : "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
            }`}
          >
            {isManualMode ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            <span>Kunci: {isManualMode ? "OFF 🔓" : "AKTIF 🔒"}</span>
          </button>

          {/* Coordinate manual trigger */}
          <button
            onClick={() => setShowCoordinateDrawer(!showCoordinateDrawer)}
            className={`py-1 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition border cursor-pointer active:scale-95 ${
              showCoordinateDrawer
                ? "bg-indigo-600/35 text-white border-indigo-500/50"
                : "bg-zinc-900 hover:bg-zinc-800 text-white/80 border-white/10"
            }`}
          >
            <Sliders className="h-3 w-3" />
            <span>Koordinat: {showCoordinateDrawer ? "ON" : "OFF"}</span>
          </button>

          {/* Re-analyze Detection Button */}
          <button
            onClick={onReAnalyze}
            disabled={page.status === "analyzing"}
            className="py-1 px-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 text-white disabled:text-white/30 rounded-lg text-[11px] font-black flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-md shadow-indigo-950/25"
          >
            <RefreshCw className={`h-3 w-3 ${page.status === "analyzing" ? "animate-spin" : ""}`} />
            <span>Deteksi AI</span>
          </button>
        </div>
      </div>

      {/* Crop Preview Section - Scrollable grid below controls */}
      <div className="w-full bg-[#08080c] border-t border-white/5 p-4 sm:p-6 pb-20 text-left shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400">Hasil Potongan Panel</h3>
              <p className="text-[11px] text-white/50 mt-0.5">Memilah & menghapus potongan halaman ini (klik pratinjau untuk menyeleksi kotak)</p>
            </div>
            {page.panels.length > 0 && (
              <span className="text-[10px] font-bold font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/15">
                {page.panels.length} PANEL
              </span>
            )}
          </div>

          {page.panels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-2xl border border-dashed border-white/10 bg-zinc-950/40 text-center">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/30 mb-2">
                <Split className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-bold text-white/70">Belum ada panel terpotong</p>
              <p className="text-[10px] text-white/40 mt-0.5 max-w-[240px]">
                Gunakan Garis Pembelah atau Gunting Seri untuk memotong area halaman komik ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {page.panels.map((panel) => {
                const isSelected = selectedPanelId === panel.id;
                return (
                  <div
                    key={panel.id}
                    onClick={() => onSelectPanel(panel.id)}
                    className={`group relative rounded-xl overflow-hidden bg-zinc-900 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-950/50"
                        : "border-white/5 hover:border-white/20 hover:bg-zinc-850 shadow-md"
                    }`}
                  >
                    {/* Thumbnail Image Container */}
                    <div className="aspect-[3/4] w-full bg-black relative flex items-center justify-center overflow-hidden">
                      {panel.croppedUrl ? (
                        <img
                          src={panel.croppedUrl}
                          alt={`Crop ${panel.reading_order_level}`}
                          className="w-full h-full object-contain group-hover:scale-102 transition duration-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-white/25">
                          <RefreshCw className="h-5 w-5 animate-spin mb-1 text-indigo-400" />
                          <span className="text-[9px] font-mono">Memotong...</span>
                        </div>
                      )}

                      {/* Order Number Badge */}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/80 backdrop-blur-md rounded border border-white/10 text-[9px] font-mono font-bold text-white shadow-md">
                        #{String(panel.reading_order_level).padStart(3, "0")}
                      </div>

                      {/* Quick Delete FAB Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePanel(panel.id, e);
                        }}
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-lg transition opacity-100 sm:opacity-90 sm:group-hover:opacity-100 z-10 cursor-pointer border border-rose-500/20"
                        title="Hapus Potongan Ini"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Card Footer / Details */}
                    <div className="p-2 bg-[#0c0c12] border-t border-white/[0.03] text-left">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-mono text-white/50 truncate">
                          {panel.position_name || "Custom Cut"}
                        </span>
                        <span className="text-[8px] font-mono text-indigo-400 shrink-0">
                          {Math.round(panel.box_2d[3] - panel.box_2d[1])}x{Math.round(panel.box_2d[2] - panel.box_2d[0])}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* End of Scrollable Main Area */}
      </div>

      {/* Floating Page Nav - Left (stays floating over the canvas container edges) */}
      {hasPrevPage && (
        <button
          onClick={onPrevPage}
          className="absolute left-3 sm:left-5 top-1/3 -translate-y-1/2 z-35 w-11 h-11 rounded-full bg-black/80 hover:bg-black/95 active:scale-95 text-white flex items-center justify-center border border-white/10 shadow-2xl transition cursor-pointer"
          title="Halaman Sebelumnya"
        >
          <ChevronLeft className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Floating Page Nav - Right (stays floating over the canvas container edges) */}
      {hasNextPage && (
        <button
          onClick={onNextPage}
          className="absolute right-3 sm:right-5 top-1/3 -translate-y-1/2 z-35 w-11 h-11 rounded-full bg-indigo-600/90 hover:bg-indigo-600 active:scale-95 text-white flex items-center justify-center border border-indigo-500/20 shadow-2xl transition cursor-pointer"
          title="Halaman Selanjutnya"
        >
          <ChevronRight className="h-6 w-6 text-white" />
        </button>
      )}

      {/* End of SCROLLABLE VIEWPORT CONTAINER */}
      </div>

      {/* OVERLAY SLIDE-UP SHEET coords manual micro-control widget */}
      <AnimatePresence>
        {showCoordinateDrawer && selectedPanel && (
          <div 
            className="absolute bottom-0 inset-x-0 bg-zinc-950/98 border-t border-zinc-850 rounded-t-3xl p-4 shadow-3xl z-45"
          >
            {/* Drawer line handle representer */}
            <div className="flex items-center justify-center mb-3">
              <button 
                onClick={() => setShowCoordinateDrawer(false)}
                className="w-12 h-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between mb-3 text-left">
              <div>
                <span className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Pengendali Koordinat manual
                </span>
                <span className="text-xs font-bold text-white block mt-1">Fine-Tune Batas Crop Kotak (0 hingga 1000)</span>
              </div>
              <button 
                onClick={() => setShowCoordinateDrawer(false)}
                className="text-[10px] font-bold text-white/40 hover:text-white bg-white/5 px-2.5 py-1 rounded-lg cursor-pointer"
              >
                Selesai
              </button>
            </div>

            {/* fine coordinate increment panels */}
            <div className="grid grid-cols-2 gap-2 text-left">
              {[
                { label: "Batas Y Atas (Y1)", index: 0 },
                { label: "Batas X Kiri (X1)", index: 1 },
                { label: "Batas Y Bawah (Y2)", index: 2 },
                { label: "Batas X Kanan (X2)", index: 3 },
              ].map((coord) => (
                <div key={coord.index} className="bg-zinc-900/80 p-2 rounded-xl border border-white/[0.03]">
                  <span className="text-[10px] font-semibold text-white/50 block mb-1">{coord.label}</span>
                  <div className="flex items-center justify-between gap-1">
                    <button 
                      onClick={() => handleManualCoordChange(coord.index, selectedPanel.box_2d[coord.index] - 5)}
                      className="p-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-750 text-white font-mono text-[10px] font-black cursor-pointer"
                    >
                      -5
                    </button>
                    <input 
                      type="number"
                      min="0"
                      max="1000"
                      value={selectedPanel.box_2d[coord.index]}
                      onChange={(e) => handleManualCoordChange(coord.index, parseInt(e.target.value) || 0)}
                      className="w-12 h-7 text-center text-xs bg-black text-indigo-300 font-mono border border-zinc-800 rounded"
                    />
                    <button 
                      onClick={() => handleManualCoordChange(coord.index, selectedPanel.box_2d[coord.index] + 5)}
                      className="p-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-750 text-white font-mono text-[10px] font-black cursor-pointer"
                    >
                      +5
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-white/30 bg-black/45 px-3 py-1.5 rounded-lg border border-white/[0.02]">
              <span>Dimensi: {Math.round(selectedPanel.box_2d[3] - selectedPanel.box_2d[1])} x {Math.round(selectedPanel.box_2d[2] - selectedPanel.box_2d[0])} unit</span>
              <span className="text-white/10">|</span>
              <span>Index urutan level: {selectedPanel.reading_order_level}</span>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
