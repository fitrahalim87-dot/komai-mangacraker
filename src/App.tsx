import React, { useRef, useState, useEffect } from "react";
import { MangaPage, MangaPanel } from "./types";
import { sortMangaPanels, generateMangaDemoSheet, cropMangaPanel } from "./utils";
import CropWorkspace from "./components/CropWorkspace";
import { motion, AnimatePresence } from "motion/react";
import { 
  Home, 
  Layers, 
  Image as ImageIcon, 
  Settings as SettingsIcon,
  Plus, 
  Sparkles, 
  FolderDown, 
  HelpCircle, 
  AlertCircle, 
  X,
  Compass,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Edit,
  Check,
  Maximize2,
  Minimize2,
  Wifi,
  Battery,
  CloudLightning,
  RefreshCw,
  FolderOpen,
  Key,
  Eye,
  EyeOff,
  ExternalLink
} from "lucide-react";
import JSZip from "jszip";

export default function App() {
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  
  // Navigation: Home, Workspace, Panels, Settings
  const [activeTab, setActiveTab] = useState<"home" | "workspace" | "panels" | "settings">("home");
  
  // Immersive state
  const [fullscreenEnabled, setFullscreenEnabled] = useState<boolean>(true);

  // Google AI Studio API Key State (For users to use their own Gemini key)
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem("koma_gemini_api_key") || "";
  });
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [showKeyInput, setShowKeyInput] = useState(false);
  
  // Theme state
  const [theme, setTheme] = useState<"charcoal" | "cobalt" | "crimson" | "emerald" | "slate">("charcoal");

  // AI Autodetect toggle state (Requirement 2)
  const [isAiEnabled, setIsAiEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("koma_ai_enabled");
    return saved !== "false"; // default to true
  });

  const handleToggleAi = (val: boolean) => {
    setIsAiEnabled(val);
    localStorage.setItem("koma_ai_enabled", String(val));
  };

  // Panels slider active index
  const [activePanelCarouselIndex, setActivePanelCarouselIndex] = useState<number>(0);

  // Time stamp state for simulated mobile top bar
  const [currentTime, setCurrentTime] = useState("12:00");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active page selector helper
  const activePage = pages.find(p => p.id === activePageId) || null;

  const pageIndex = pages.findIndex(p => p.id === activePageId);
  const hasPrevPage = pageIndex > 0;
  const hasNextPage = pageIndex < pages.length - 1 && pageIndex !== -1;

  const handlePrevPage = () => {
    if (hasPrevPage) {
      const prevPage = pages[pageIndex - 1];
      setActivePageId(prevPage.id);
      setSelectedPanelId(prevPage.panels[0]?.id || null);
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      const nextPage = pages[pageIndex + 1];
      setActivePageId(nextPage.id);
      setSelectedPanelId(nextPage.panels[0]?.id || null);
    }
  };

  // Global sequential list of all panels across all pages
  const flatPanelList: { pageId: string; pageName: string; panel: MangaPanel; absoluteIndex: number }[] = [];
  let absoluteCounter = 1;
  pages.forEach(p => {
    p.panels.forEach(pan => {
      flatPanelList.push({
        pageId: p.id,
        pageName: p.name,
        panel: pan,
        absoluteIndex: absoluteCounter++
      });
    });
  });

  // Automated Sequential Upload loop (respects the "Page 1 first completely, then Page 2..." rule)
  useEffect(() => {
    if (!isAiEnabled) return; // Prevent AI from auto-generating!

    const idlePage = pages.find(p => p.status === "idle");
    const isAnalyzing = pages.some(p => p.status === "analyzing");

    if (idlePage && !isAnalyzing) {
      triggerDetectionForPage(idlePage.id, idlePage.url);
    }
  }, [pages, isAiEnabled]);

  // Simulated status bar clock updater
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      setCurrentTime(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Automatic fullscreen trigger during interaction
  useEffect(() => {
    if (fullscreenEnabled) {
      const triggerFullscreenOnce = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      };
      window.addEventListener("pointerdown", triggerFullscreenOnce, { once: true });
      return () => {
        window.removeEventListener("pointerdown", triggerFullscreenOnce);
      };
    }
  }, [fullscreenEnabled]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Fullscreen permission denied or blocked inside frame.", err);
      });
      setFullscreenEnabled(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreenEnabled(false);
    }
  };

  // Performs Gemini panel segmentation API call
  const triggerDetectionForPage = async (pageId: string, base64Image: string) => {
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, status: "analyzing", error: null } : p));

    try {
      const res = await fetch("/api/detect-panels", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-gemini-api-key": apiKey
        },
        body: JSON.stringify({ 
          image: base64Image,
          apiKey: apiKey
        })
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errMessage = `Server responded with status ${res.status}`;
        try {
          const errData = JSON.parse(text);
          if (errData && errData.error) errMessage = errData.error;
        } catch {
          if (text.includes("<!doctype html>") || text.includes("<html")) {
            errMessage = "The request timed out or received an invalid HTML fallback. Please try again with a smaller image or re-trigger Autodetect AI.";
          }
        }
        throw new Error(errMessage);
      }

      const resText = await res.text();
      let data: any;
      try {
        data = JSON.parse(resText);
      } catch (parseErr) {
        if (resText.includes("<!doctype html>") || resText.includes("<html")) {
          throw new Error("The request timed out or received an invalid HTML fallback. Please try again with a smaller image or re-trigger Autodetect AI.");
        }
        throw new Error("Could not parse a valid JSON response from the server.");
      }

      if (!data.panels || !Array.isArray(data.panels)) {
        throw new Error("Invalid response received from the manga analyzer API.");
      }

      const rawPanels: MangaPanel[] = data.panels.map((p: any, idx: number) => ({
        id: `ai_${pageId}_${idx}_${Date.now()}`,
        box_2d: p.box_2d as [number, number, number, number],
        description: p.description || "Detected panel element",
        position_name: p.position_name || "Pane Segment",
        reading_order_level: idx + 1,
        croppedUrl: null
      }));

      // Sort right-to-left, top-to-bottom
      const sorted = sortMangaPanels(rawPanels);

      // Extract thumbnails instantly
      const croppedPromises = sorted.map(async (panel) => {
        try {
          const cropUrl = await cropMangaPanel(base64Image, panel.box_2d);
          return { ...panel, croppedUrl: cropUrl };
        } catch {
          return panel;
        }
      });

      const panelsWithImages = await Promise.all(croppedPromises);

      setPages(prev => prev.map(p => {
        if (p.id === pageId) {
          return {
            ...p,
            status: "success",
            panels: panelsWithImages
          };
        }
        return p;
      }));

    } catch (err: any) {
      console.error(err);
      setPages(prev => prev.map(p => p.id === pageId ? { ...p, status: "error", error: err.message } : p));
      setGlobalError(`Page segmentation failed: ${err.message}`);
    }
  };

  // Switch pages handler
  const handleSelectPage = (id: string) => {
    setActivePageId(id);
    const targetPage = pages.find(p => p.id === id);
    if (targetPage && targetPage.panels.length > 0) {
      setSelectedPanelId(targetPage.panels[0].id);
    } else {
      setSelectedPanelId(null);
    }
  };

  // Switch selected panel + switch page automatically if necessary
  const handleSelectPanel = (panelId: string, pageId: string) => {
    if (activePageId !== pageId) {
      setActivePageId(pageId);
    }
    setSelectedPanelId(panelId);
  };

  // Callback from Crop Workspace to modify panel coordinates or properties
  const handleUpdatePanels = (updatedPanels: MangaPanel[]) => {
    if (!activePageId) return;
    setPages(prev => prev.map(p => {
      if (p.id === activePageId) {
        return { ...p, panels: updatedPanels };
      }
      return p;
    }));
  };

  // Re-order sorting triggered manually
  const handleSortPagePanels = () => {
    if (!activePage) return;
    const sorted = sortMangaPanels(activePage.panels);
    handleUpdatePanels(sorted);
  };

  // Global panel re-ordering across pages
  const handleReorderPanels = (direction: "up" | "down", targetIndex: number) => {
    const flatCopy = [...flatPanelList];
    if (direction === "up" && targetIndex > 0) {
      const temp = flatCopy[targetIndex];
      flatCopy[targetIndex] = flatCopy[targetIndex - 1];
      flatCopy[targetIndex - 1] = temp;
    } else if (direction === "down" && targetIndex < flatCopy.length - 1) {
      const temp = flatCopy[targetIndex];
      flatCopy[targetIndex] = flatCopy[targetIndex + 1];
      flatCopy[targetIndex + 1] = temp;
    }

    // Distribute panels back into their respective pages
    const pageMap = new Map<string, MangaPanel[]>();
    pages.forEach(p => pageMap.set(p.id, []));

    flatCopy.forEach((item) => {
      const lst = pageMap.get(item.pageId) || [];
      const updatedPanel: MangaPanel = {
        ...item.panel,
        reading_order_level: lst.length + 1
      };
      lst.push(updatedPanel);
      pageMap.set(item.pageId, lst);
    });

    setPages(prev => prev.map(p => ({
      ...p,
      panels: pageMap.get(p.id) || []
    })));
  };

  // Update caption description manually
  const handleUpdateDescription = (pageId: string, panelId: string, text: string) => {
    setPages(prev => prev.map(p => {
      if (p.id === pageId) {
        return {
          ...p,
          panels: p.panels.map(pan => pan.id === panelId ? { ...pan, description: text } : pan)
        };
      }
      return p;
    }));
  };

  // Remove panel item completely
  const handleDeletePanelGlobal = (pageId: string, panelId: string) => {
    setPages(prev => prev.map(p => {
      if (p.id === pageId) {
        const filtered = p.panels.filter(pan => pan.id !== panelId);
        const reindexed = filtered.map((pan, idx) => ({ ...pan, reading_order_level: idx + 1 }));
        return { ...p, panels: reindexed };
      }
      return p;
    }));

    if (selectedPanelId === panelId) {
      setSelectedPanelId(null);
    }

    // Adjust active slide if we were at the end
    if (activePanelCarouselIndex > 0 && activePanelCarouselIndex >= flatPanelList.length - 1) {
      setActivePanelCarouselIndex(Math.max(0, flatPanelList.length - 2));
    }
  };

  // Delete page worksheet completely
  const handleDeletePage = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const filtered = pages.filter(p => p.id !== id);
    setPages(filtered);

    if (activePageId === id) {
      if (filtered.length > 0) {
        setActivePageId(filtered[0].id);
        setSelectedPanelId(filtered[0].panels[0]?.id || null);
      } else {
        setActivePageId(null);
        setSelectedPanelId(null);
      }
    }
  };

  const [isEditingDescriptionId, setIsEditingDescriptionId] = useState<string | null>(null);
  const [editedDescriptionText, setEditedDescriptionText] = useState("");

  // File Upload Handlers (Supports multiple sheet drops / file selectors)
  const handleFilesAdded = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const loadedPagesList: MangaPage[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith("image/")) continue;

      const pageId = `uploaded_page_${Date.now()}_${i}`;

      const reader = new FileReader();
      const readPromise = new Promise<{ base64: string; dimensions: { width: number; height: number } }>((resolve) => {
        reader.onload = (e) => {
          const resStr = e.target?.result as string;
          const tempImg = new Image();
          tempImg.onload = () => {
            resolve({
              base64: resStr,
              dimensions: { width: tempImg.width || 800, height: tempImg.height || 1100 }
            });
          };
          tempImg.src = resStr;
        };
        reader.readAsDataURL(file);
      });

      const { base64, dimensions } = await readPromise;

      const newPage: MangaPage = {
        id: pageId,
        name: file.name,
        url: base64,
        width: dimensions.width,
        height: dimensions.height,
        status: "idle",
        error: null,
        panels: []
      };

      loadedPagesList.push(newPage);
    }

    if (loadedPagesList.length > 0) {
      setPages(prev => {
        const next = [...prev, ...loadedPagesList];
        if (!activePageId) {
          setActivePageId(loadedPagesList[0].id);
        }
        return next;
      });
      // automatically slide theme active to workspace
      setActiveTab("workspace");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFilesAdded(e.dataTransfer.files);
  };

  // Spawns local preloaded demo instantly
  const handleLoadDemoSheet = async () => {
    const demoUrl = generateMangaDemoSheet();
    const pageId = `demo_page_${Date.now()}`;

    const demoPanelsRaw: MangaPanel[] = [
      {
        id: `demo_p1_${Date.now()}`,
        box_2d: [60, 440, 380, 940],
        description: "Dramatic zoom-in panel depicting determined eyes shaded by thick, stylized speed lines.",
        position_name: "Top-Right Face",
        reading_order_level: 1,
        croppedUrl: null
      },
      {
        id: `demo_p2_${Date.now()}`,
        box_2d: [60, 60, 380, 420],
        description: "Comic word frame showing an energetic explosion bubble yelling 'N-NANI?!'.",
        position_name: "Top-Left NANI?!",
        reading_order_level: 2,
        croppedUrl: null
      },
      {
        id: `demo_p3_${Date.now()}`,
        box_2d: [400, 60, 700, 940],
        description: "Epic wide panel conveying a heavy sword-slash strike alongside 'ZZZHT!!' effects.",
        position_name: "Center Slash",
        reading_order_level: 3,
        croppedUrl: null
      },
      {
        id: `demo_p4_${Date.now()}`,
        box_2d: [720, 510, 1000, 940],
        description: "Neighborhood scenery silhouette illustrating house rooftops and lighting beams.",
        position_name: "Bottom-Right Scenery",
        reading_order_level: 4,
        croppedUrl: null
      },
      {
        id: `demo_p5_${Date.now()}`,
        box_2d: [720, 60, 1000, 490],
        description: "Anime characters back profile outline accompanied by an anxious blue sweat drop drop.",
        position_name: "Bottom-Left Exhaust",
        reading_order_level: 5,
        croppedUrl: null
      }
    ];

    // Crop each frame locally on canvas instantly
    const withCrops = await Promise.all(
      demoPanelsRaw.map(async (panel) => {
        try {
          const cropped = await cropMangaPanel(demoUrl, panel.box_2d);
          return { ...panel, croppedUrl: cropped };
        } catch {
          return panel;
        }
      })
    );

    const demoPageCount = pages.filter(p => p.id.startsWith("demo_page_")).length + 1;

    const newPage: MangaPage = {
      id: pageId,
      name: `Demo Page #${demoPageCount}.jpg`,
      url: demoUrl,
      width: 800,
      height: 1100,
      status: "success",
      error: null,
      panels: withCrops
    };

    setPages(prev => [...prev, newPage]);
    setActivePageId(pageId);
    setSelectedPanelId(withCrops[0].id);
    setActiveTab("workspace");
  };

  // Individual direct downloader
  const handleDownloadSinglePanel = (panel: MangaPanel, filename: string) => {
    if (!panel.croppedUrl) return;
    const a = document.createElement("a");
    a.href = panel.croppedUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ZIP exporter
  const handleDownloadAllAsZIP = async () => {
    if (flatPanelList.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();

      flatPanelList.forEach(({ panel, absoluteIndex }) => {
        if (!panel.croppedUrl) return;
        const filename = `panel_${String(absoluteIndex).padStart(3, "0")}.jpg`;
        const base64Str = panel.croppedUrl.split(",")[1];
        zip.file(filename, base64Str, { base64: true });
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const dlLink = document.createElement("a");
      dlLink.href = URL.createObjectURL(zipBlob);
      dlLink.download = "manga_panels_extracted.zip";
      document.body.appendChild(dlLink);
      dlLink.click();
      document.body.removeChild(dlLink);
    } catch (e: any) {
      console.error(e);
      setGlobalError(`Zip construction failed: ${e.message}`);
    } finally {
      setIsZipping(false);
    }
  };

  const handleTriggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Reset APP state
  const handleResetApplication = () => {
    setPages([]);
    setActivePageId(null);
    setSelectedPanelId(null);
    setActiveTab("home");
  };

  // Theme helper definitions
  const getColors = () => {
    switch (theme) {
      case "cobalt":
        return {
          bg: "bg-[#050B14]", // deep cobalt space dark
          topBar: "bg-[#091122]/95 border-[#122240]",
          accent: "#2563EB",
          accentText: "text-[#60A5FA]",
          btn: "bg-[#2563eb] hover:bg-[#3b82f6] text-white",
          pill: "bg-[#2563eb]/20 text-[#60A5FA] border border-[#2563eb]/30",
          cardBg: "bg-[#0D1527]/90 border-[#1B2D54]",
          cardBorder: "border-[#1B2D54]",
          bottomNav: "bg-[#091122]/98 border-[#122240]"
        };
      case "crimson":
        return {
          bg: "bg-[#0C0202]", // black ruby
          topBar: "bg-[#180404]/95 border-[#300808]",
          accent: "#E11D48",
          accentText: "text-[#F43F5E]",
          btn: "bg-[#E11D48] hover:bg-[#F43F5E] text-white",
          pill: "bg-[#E11D48]/20 text-[#F43F5E] border border-[#E11D48]/30",
          cardBg: "bg-[#160606]/90 border-[#381111]",
          cardBorder: "border-[#381111]",
          bottomNav: "bg-[#180404]/98 border-[#300808]"
        };
      case "emerald":
        return {
          bg: "bg-[#020804]", // moss forest dark
          topBar: "bg-[#05130A]/95 border-[#0D2615]",
          accent: "#059669",
          accentText: "text-[#10B981]",
          btn: "bg-[#059669] hover:bg-[#10B981] text-white",
          pill: "bg-[#059669]/20 text-[#10B981] border border-[#059669]/30",
          cardBg: "bg-[#081B0F]/90 border-[#154625]",
          cardBorder: "border-[#154625]",
          bottomNav: "bg-[#05130A]/98 border-[#0D2615]"
        };
      case "slate":
        return {
          bg: "bg-[#0B0F19]", // metallic steel slate
          topBar: "bg-[#131B2E]/95 border-[#1E293B]",
          accent: "#0ea5e9",
          accentText: "text-[#38bdf8]",
          btn: "bg-[#0284c7] hover:bg-[#38bdf8] text-white",
          pill: "bg-[#0284c7]/20 text-[#38bdf8] border border-[#0284c7]/30",
          cardBg: "bg-[#16223F]/90 border-[#2D3E5E]",
          cardBorder: "border-[#2D3E5E]",
          bottomNav: "bg-[#131B2E]/98 border-[#1E293B]"
        };
      case "charcoal":
      default:
        return {
          bg: "bg-[#070709]", // pristine graphite pure black
          topBar: "bg-[#0E0E12]/95 border-zinc-800",
          accent: "#6366F1",
          accentText: "text-indigo-400",
          btn: "bg-indigo-600 hover:bg-indigo-500 text-white",
          pill: "bg-indigo-600/20 text-indigo-400 border border-indigo-500/20",
          cardBg: "bg-[#111115]/95 border-zinc-850",
          cardBorder: "border-zinc-850",
          bottomNav: "bg-[#0E0E12]/98 border-zinc-800"
        };
    }
  };

  const c = getColors();

  if (!apiKey) {
    return (
      <div 
        id="manga-extractor-android-gate" 
        className="h-[100dvh] w-screen flex flex-col items-center justify-center bg-[#070709] text-[#F4F4F5] font-sans antialiased p-6 text-center overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.95, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="max-w-md w-full bg-[#111115] border border-zinc-800 p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6 text-left"
        >
          {/* Logo / Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
              <Key className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <span className="font-mono text-[9px] tracking-widest font-extrabold uppercase text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-500/10">
                KOMA-AI Setup
              </span>
              <h3 className="text-base font-black uppercase text-white tracking-wider mt-1">Setup API Key Gemini</h3>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-white/70 leading-relaxed">
              Selamat datang di <span className="font-bold text-indigo-400">KOMA-AI Panel Extractor</span>! Untuk mendeteksi panel manga secara otomatis menggunakan kecerdasan buatan, silakan masukkan <strong>Google AI Studio API Key</strong> Anda.
            </p>
            
            {/* Guide to Google AI Studio */}
            <div className="bg-indigo-950/20 border border-indigo-500/10 p-3.5 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Cara Mendapatkan API Key Gratis:
              </h4>
              <ol className="text-[11px] text-white/60 space-y-1 list-decimal pl-4 leading-normal">
                <li>Klik tombol di bawah untuk membuka halaman pendaftaran.</li>
                <li>Buat kunci baru dengan mengeklik <strong>Create API Key</strong>.</li>
                <li>Salin kuncinya lalu tempelkan di kolom input di bawah ini.</li>
              </ol>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-lg transition uppercase tracking-wider cursor-pointer"
              >
                <span>Dapatkan API Key Gratis ↗</span>
              </a>
            </div>
          </div>

          {/* Input Box */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-white/50 block">API Key Anda</label>
            <div className="relative flex items-center">
              <input
                type={showKeyInput ? "text" : "password"}
                placeholder="AIzaSy..."
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                className="w-full bg-black/40 border border-zinc-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 outline-hidden transition pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="absolute right-3 text-zinc-500 hover:text-white transition cursor-pointer"
              >
                {showKeyInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={() => {
                const trimmed = tempApiKey.trim();
                if (!trimmed) {
                  alert("API Key tidak boleh kosong!");
                  return;
                }
                localStorage.setItem("koma_gemini_api_key", trimmed);
                setApiKey(trimmed);
                // Trigger full screen on successful enter
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
                setFullscreenEnabled(true);
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl uppercase tracking-wider transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20"
            >
              <Check className="h-4 w-4" />
              <span>Simpan &amp; Masuk ke Aplikasi</span>
            </button>
            
            <p className="text-[9px] text-zinc-500 text-center leading-snug">
              Kunci Anda disimpan secara aman &amp; lokal di browser (localStorage) Anda dan hanya dikirimkan ke server Anda sendiri demi privasi.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      id="manga-extractor-android" 
      className={`h-[100dvh] w-screen flex flex-col overflow-hidden ${c.bg} text-[#F4F4F5] font-sans antialiased select-none`}
    >
      {/* Floating Action Header for Support & Alerts (Zero height UI block to prevent scroll) - moved to top-left to avoid any canvas overlaps in top-right */}
      <div className="absolute top-4 left-4 z-45 flex items-center gap-2 pointer-events-none">
        {globalError && (
          <button 
            onClick={() => {
              alert(globalError);
              setGlobalError(null);
            }}
            className="pointer-events-auto p-1 px-2.5 bg-red-950/90 border border-red-500/35 text-rose-300 font-bold text-[10px] rounded-full flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            <span>Sistem Error</span>
          </button>
        )}
      </div>

      {/* Hidden inputs to capture uploads */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFilesAdded(e.target.files)}
      />

      {/* 3. Action Sheet Instruction Overlay */}
      <AnimatePresence>
        {showHowTo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md z-55 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className={`${c.cardBg} border rounded-3xl p-6 max-w-sm w-full shadow-2xl relative`}
            >
              <button 
                onClick={() => setShowHowTo(false)}
                className="absolute top-4 right-4 p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <h2 className={`text-sm font-bold uppercase tracking-widest ${c.accentText} mb-2`}>Panduan Penggunaan</h2>
              <div className="space-y-4 text-xs leading-relaxed text-white/70">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-indigo-500/20">1</div>
                  <p>Manga diunduh atau difoto, lalu diunggah di tab <span className="font-bold text-white">Home</span>. AI akan mendeteksi kotak panel secara otomatis.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-indigo-500/20">2</div>
                  <p>Jika kotak tidak sengaja tergeser, pastikan tombol <span className="font-bold text-amber-400">Kunci: AKTIF</span> hidup untuk mengunci pergeseran kotak saat scrolling.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 bg-indigo-500/20 text-indigo-400 font-mono text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-indigo-500/20">3</div>
                  <p>Sesuaikan kotak di tab <span className="font-bold text-white">Workspace</span> dengan menyalakan pengeditan manual. Ekstrak manga favoritmu langsung ke ZIP di tab <span className="font-bold text-white">Panels</span>!</p>
                </div>
              </div>

              <button 
                onClick={() => setShowHowTo(false)}
                className={`w-full mt-6 py-2.5 rounded-xl font-bold text-xs uppercase cursor-pointer ${c.btn}`}
              >
                Mengerti & Tutup
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Core Active View Container */}
      <main className="flex-1 w-full overflow-hidden relative">
        <AnimatePresence mode="wait">
          
          {/* TAB: HOME SCREEN */}
          {activeTab === "home" && (
            <motion.div
              key="home-tab"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex flex-col p-4 overflow-y-auto space-y-5"
            >
              {/* Feature banners */}
              <div className="bg-gradient-to-br from-indigo-900/40 via-indigo-950/20 to-transparent p-5 rounded-3xl border border-white/5 relative overflow-hidden shrink-0 text-left">
                <div className="absolute top-0 right-0 p-6 text-7xl font-extrabold text-white/[0.012] font-mono select-none pointer-events-none">
                  漫
                </div>
                <h2 className="text-base font-black tracking-tight text-white mb-1">KOMAI MANGACRACKER</h2>
                <p className="text-xs text-white/50 leading-relaxed max-w-xs font-normal">
                  Extractor Panel Manga Otomatis berbasis AI. Dirancang khusus untuk kenyamanan perangkat seluler.
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHowTo(true);
                  }}
                  className="mt-3.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer self-start"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>Buka Panduan Cepat</span>
                </button>
              </div>

              {/* Upload section slot */}
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={handleTriggerUploadClick}
                className="bg-[#0D0D10] border border-dashed border-zinc-800 hover:border-indigo-500/40 rounded-3xl p-6 text-center flex flex-col items-center justify-center min-h-[140px] cursor-pointer active:scale-[0.98] transition-all duration-150 shrink-0"
              >
                <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 mb-3">
                  <Plus className="h-5 w-5" />
                </div>
                <h3 className="text-xs font-bold text-white tracking-tight">Unggah Lembar Manga</h3>
                <p className="text-[10px] text-white/40 mt-1 max-w-[200px] leading-snug">
                  Ketuk untuk memilih berkas JPG, PNG, atau WEBP secara langsung dari memori telepon.
                </p>
              </div>

              {/* Demo Manga quickly loader card */}
              <div 
                onClick={handleLoadDemoSheet}
                className="bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 p-4 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all duration-150 shrink-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 shrink-0">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-white">Instan Demo Manga</h4>
                    <p className="text-[10px] text-white/40 leading-snug">Muat halaman sketsa contoh manga siap potong.</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/40" />
              </div>

              {/* Recent pages list shelf */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono">Daftar Lembar Proyek ({pages.length})</span>
                  {pages.length > 0 && (
                    <button 
                      onClick={handleResetApplication}
                      className="text-[9px] uppercase tracking-wider font-mono text-red-400/80 hover:text-red-400 font-bold"
                    >
                      Hapus Semua
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-4">
                  {pages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-10 text-center bg-[#070709] rounded-2xl border border-white/5 border-dashed">
                      <FolderOpen className="h-8 w-8 text-white/10 mb-2" />
                      <p className="text-[11px] font-bold text-white/40">Kosong</p>
                      <p className="text-[9px] text-white/30 max-w-[150px] leading-snug mt-1">Unggah lembar manga untuk memunculkan riwayat proyek.</p>
                    </div>
                  ) : (
                    pages.map((p, idx) => {
                      const isActive = activePageId === p.id;
                      return (
                        <div 
                          key={p.id}
                          onClick={() => {
                            handleSelectPage(p.id);
                            setActiveTab("workspace");
                          }}
                          className={`p-3 rounded-xl border flex items-center gap-4 transition active:scale-[0.99] cursor-pointer ${
                            isActive 
                              ? "border-indigo-500/70 bg-indigo-950/10" 
                              : "border-zinc-850 bg-zinc-900/30 hover:bg-zinc-900/50"
                          }`}
                        >
                          <div className="w-10 h-14 rounded-md border border-white/10 overflow-hidden bg-black shrink-0 relative">
                            <img src={p.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            {p.status === "analyzing" && (
                              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                                <RefreshCw className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white truncate max-w-[120px]">{p.name || `Halaman ${idx+1}`}</span>
                              <button 
                                onClick={(e) => handleDeletePage(p.id, e)}
                                className="p-1 hover:bg-white/5 rounded text-white/30 hover:text-rose-400 transition"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-[9px] font-mono text-white/40 block mt-0.5 truncate">{p.width} x {p.height} px</span>
                            
                            {/* status pill */}
                            <div className="mt-2">
                              {p.status === "analyzing" ? (
                                <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/10 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">Proses AI...</span>
                              ) : p.status === "error" ? (
                                <span className="bg-red-500/10 text-red-400 border border-red-500/10 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Gagal</span>
                              ) : (
                                <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">{p.panels.length} panel terdeteksi</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: WORKSPACE SCREEN */}
          {activeTab === "workspace" && (
            <motion.div
              key="workspace-tab"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              {activePage ? (
                <div className="flex-1 flex flex-col overflow-hidden h-full">
                  <CropWorkspace
                    page={activePage}
                    selectedPanelId={selectedPanelId}
                    onSelectPanel={(id) => setSelectedPanelId(id)}
                    onUpdatePanels={handleUpdatePanels}
                    onReAnalyze={() => triggerDetectionForPage(activePage.id, activePage.url)}
                    hoveredPanelId={hoveredPanelId}
                    onPrevPage={handlePrevPage}
                    onNextPage={handleNextPage}
                    hasPrevPage={hasPrevPage}
                    hasNextPage={hasNextPage}
                    pageIndex={pageIndex}
                    totalPages={pages.length}
                    isAiEnabled={isAiEnabled}
                    onToggleAi={handleToggleAi}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none">
                  <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white/30 mb-4 animate-bounce">
                    <Compass className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Lembar Kerja Kosong</h3>
                  <p className="text-xs text-white/40 mt-1.5 max-w-[210px] leading-relaxed">
                    Silakan unggah gambar manga di tab <span className="font-bold text-indigo-400">Home</span> terlebih dahulu untuk memulai pengeditan lab.
                  </p>
                  <button 
                    onClick={() => setActiveTab("home")}
                    className={`mt-4 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition ${c.btn}`}
                  >
                    Buka Home Screen
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: PANELS SCREEN */}
          {activeTab === "panels" && (
            <motion.div
              key="panels-tab"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex flex-col p-4 overflow-hidden"
            >
              {/* Stats action header */}
              <div className="flex items-center justify-between mb-4 bg-zinc-900/30 p-3 rounded-2xl border border-white/5 shrink-0">
                <div className="text-left">
                  <span className="text-[10px] text-white/40 uppercase font-mono tracking-widest font-bold">Tersegmentasi</span>
                  <p className="text-sm font-black text-white">{flatPanelList.length} Potongan Panel</p>
                </div>

                <button
                  onClick={handleDownloadAllAsZIP}
                  disabled={flatPanelList.length === 0 || isZipping}
                  className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition select-none cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
                >
                  <FolderDown className="h-4 w-4 shrink-0" />
                  {isZipping ? "ZIP..." : "ZIP SEMUA"}
                </button>
              </div>

              {/* Swipe/carousel logic holder */}
              {flatPanelList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4 select-none">
                  <div className="p-3 bg-[#111114] rounded-full mb-3 text-white/30 border border-white/5 animate-pulse">
                    <ImageIcon className="h-8 w-8 text-indigo-455" />
                  </div>
                  <p className="text-xs font-bold text-[#E4E4E7]">Belum ada panel terpotong</p>
                  <p className="text-[10px] text-white/40 mt-1 max-w-[200px] leading-relaxed">
                    Unggah manga di tab Home lalu arahkan ke lab Workspace untuk mengonfirmasi crops otomatis.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 justify-between">
                  
                  {/* Slider Card display */}
                  {(() => {
                    // bounds indexing safety
                    const safeIndex = Math.min(activePanelCarouselIndex, flatPanelList.length - 1);
                    const item = flatPanelList[safeIndex];
                    if (!item) return null;

                    const panel = item.panel;
                    const filename = `panel_${String(item.absoluteIndex).padStart(3, "0")}.jpg`;
                    const isSelected = selectedPanelId === panel.id;

                    return (
                      <div className="flex-1 flex flex-col min-h-0 justify-between space-y-4">
                        
                        {/* Swipe selector trigger headers */}
                        <div className="flex items-center justify-between px-1 shrink-0">
                          <span className="text-[11px] font-mono text-white/40 truncate max-w-[150px]" title={item.pageName}>
                            Halaman: {item.pageName}
                          </span>
                          
                          <span className="text-[11px] font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/15 px-2 py-0.5 rounded-full">
                            Panel {safeIndex + 1} dari {flatPanelList.length}
                          </span>
                        </div>

                        {/* Core Preview box container and swipe handlers */}
                        <div className="flex-1 bg-black/60 rounded-3xl border border-zinc-800 p-3 flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden">
                          
                          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between z-10 pointer-events-none">
                            <button 
                              onClick={() => setActivePanelCarouselIndex(prev => Math.max(0, prev - 1))}
                              disabled={safeIndex === 0}
                              className="p-1 px-2.5 bg-black/80 hover:bg-indigo-600 disabled:opacity-5 text-white border border-white/10 rounded-full cursor-pointer transition active:scale-95 pointer-events-auto"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button 
                              onClick={() => {
                                handleSelectPanel(panel.id, item.pageId);
                                setActivePanelCarouselIndex(prev => Math.min(flatPanelList.length - 1, prev + 1));
                              }}
                              disabled={safeIndex === flatPanelList.length - 1}
                              className="p-1 px-2.5 bg-black/80 hover:bg-indigo-600 disabled:opacity-5 text-white border border-white/10 rounded-full cursor-pointer transition active:scale-95 pointer-events-auto"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          </div>

                          {/* Image crop core renderer */}
                          <div className="w-full h-full max-h-[220px] rounded-2xl overflow-hidden flex items-center justify-center relative">
                            {panel.croppedUrl ? (
                              <img 
                                src={panel.croppedUrl} 
                                alt="panel visual" 
                                className="max-w-full max-h-full object-contain shadow-2xl border border-white/5 rounded-lg" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center animate-pulse">
                                <Compass className="h-6 w-6 text-indigo-400 animate-spin" />
                              </div>
                            )}

                            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-white font-mono text-[9px] px-2 py-0.5 rounded border border-white/10 font-bold">
                              {filename}
                            </span>
                          </div>
                        </div>

                        {/* Interactive metadata edits & single download controls */}
                        <div className="bg-[#0c0c0f] border border-zinc-850 p-4 rounded-2xl shrink-0 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                              {panel.position_name || "Manga Panel Element"}
                            </span>
                            <span className="text-[10px] font-mono text-white/30">
                              Unit: [{panel.box_2d.join(", ")}]
                            </span>
                          </div>

                          {/* Editable description area */}
                          {isEditingDescriptionId === panel.id ? (
                            <div className="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-xl border border-zinc-800">
                              <input 
                                type="text"
                                value={editedDescriptionText}
                                onChange={(e) => setEditedDescriptionText(e.target.value)}
                                className="flex-1 bg-transparent px-2 text-xs text-white focus:outline-hidden"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleUpdateDescription(item.pageId, panel.id, editedDescriptionText);
                                    setIsEditingDescriptionId(null);
                                  }
                                }}
                              />
                              <button 
                                onClick={() => {
                                  handleUpdateDescription(item.pageId, panel.id, editedDescriptionText);
                                  setIsEditingDescriptionId(null);
                                }}
                                className="p-1 px-2.5 bg-indigo-600 rounded-lg text-white font-bold text-[10px] flex items-center justify-center"
                              >
                                Simpan
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3 bg-zinc-900/10 p-2.5 rounded-xl border border-white/[0.02]">
                              <p className="text-xs text-slate-200/90 italic leading-snug line-clamp-2">
                                &quot;{panel.description || "Tidak ada deskripsi anotasi recorded."}&quot;
                              </p>
                              <button 
                                onClick={() => {
                                  setIsEditingDescriptionId(panel.id);
                                  setEditedDescriptionText(panel.description);
                                }}
                                className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white transition flex items-center gap-1"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          {/* card levels fine actions */}
                          <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
                            {/* Reordering buttons (RTL reading order levels) */}
                            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/5 text-[10px] font-semibold text-white/50">
                              <span>Urutan:</span>
                              <button 
                                onClick={() => {
                                  const idx = flatPanelList.findIndex(x => x.panel.id === panel.id);
                                  handleReorderPanels("up", idx);
                                }}
                                disabled={safeIndex === 0}
                                className="p-1 font-bold text-indigo-400 disabled:opacity-20 active:scale-95 px-1.5 hover:bg-white/5 rounded"
                              >
                                + Naik
                              </button>
                              <button 
                                onClick={() => {
                                  const idx = flatPanelList.findIndex(x => x.panel.id === panel.id);
                                  handleReorderPanels("down", idx);
                                }}
                                disabled={safeIndex === flatPanelList.length - 1}
                                className="p-1 font-bold text-indigo-300 disabled:opacity-20 active:scale-95 px-1.5 hover:bg-white/5 rounded"
                              >
                                - Turun
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleDownloadSinglePanel(panel, filename)}
                                disabled={!panel.croppedUrl}
                                className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 font-bold text-xs text-white rounded-xl flex items-center justify-center gap-1 shadow-md cursor-pointer shadow-indigo-950/20"
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span>Unduh</span>
                              </button>
                              <button 
                                onClick={() => handleDeletePanelGlobal(item.pageId, panel.id)}
                                className="p-2 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })()}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: SETTINGS SCREEN */}
          {activeTab === "settings" && (
            <motion.div
              key="settings-tab"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex flex-col p-4 overflow-y-auto space-y-5 text-left"
            >
              {/* Immersive settings card */}
              <div className={`${c.cardBg} rounded-3xl border p-4 shadow-xl`}>
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 mb-2 font-mono">Immersive Fullscreen Mode</h3>
                <div className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-white/5">
                  <div>
                    <h4 className="text-xs font-bold text-white">Fullscreen Otomatis</h4>
                    <p className="text-[10px] text-white/40 leading-snug">Menyembunyikan UI browser untuk memunculkan lab lapang.</p>
                  </div>
                  
                  <button 
                    onClick={toggleFullscreen}
                    className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase transition ${
                      fullscreenEnabled 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/30" 
                        : "bg-white/5 text-white/40"
                    }`}
                  >
                    {fullscreenEnabled ? "AKTIF 🔒" : "MATI 🔓"}
                  </button>
                </div>
                
                {/* Floating immersive widget trigger representation */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-white/45 bg-amber-500/5 p-2 rounded-xl border border-amber-500/10">
                  <span className="font-semibold text-amber-500">Android Mode</span>
                  <p className="text-[9px] text-white/40">Fullscreen otomatis aktif pada interaksi ketukan pertama telepon Anda.</p>
                </div>
              </div>

              {/* AI Autodetect Engine Card (Requirement 2) */}
              <div className={`${c.cardBg} rounded-3xl border p-4 shadow-xl`}>
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 mb-2 font-mono">Deteksi AI Otomatis</h3>
                <div className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-white/5">
                  <div>
                    <h4 className="text-xs font-bold text-white">AI Autodetect</h4>
                    <p className="text-[10px] text-white/40 leading-snug">Menjalankan deteksi kotak panel otomatis saat mengunggah gambar baru.</p>
                  </div>
                  
                  <button 
                    onClick={() => handleToggleAi(!isAiEnabled)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase transition ${
                      isAiEnabled 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/30" 
                        : "bg-red-550/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {isAiEnabled ? "AKTIF" : "MATI"}
                  </button>
                </div>
              </div>

              {/* Google AI Studio API Key Manager */}
              <div className={`${c.cardBg} rounded-3xl border p-4 shadow-xl space-y-3`}>
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 mb-1 font-mono flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Google AI Studio API Key</span>
                </h3>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Konfigurasikan API Key Gemini milik Anda untuk memproses pendeteksian panel otomatis.
                </p>
                
                <div className="space-y-2">
                  <div className="relative flex items-center bg-black/40 rounded-xl border border-white/5">
                    <input
                      type={showKeyInput ? "text" : "password"}
                      placeholder="AIzaSy..."
                      value={apiKey}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setApiKey(val);
                        localStorage.setItem("koma_gemini_api_key", val);
                      }}
                      className="w-full bg-transparent px-3 py-2.5 text-xs text-white outline-hidden focus:ring-0 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeyInput(!showKeyInput)}
                      className="absolute right-3 text-zinc-500 hover:text-white transition cursor-pointer"
                    >
                      {showKeyInput ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 font-bold text-[10px] rounded-lg text-center uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 border border-indigo-500/20"
                    >
                      <span>Dapatkan Key Gratis ↗</span>
                    </a>
                    
                    <button
                      onClick={() => {
                        if (confirm("Apakah Anda yakin ingin menghapus API Key ini? Anda harus memasukkannya kembali untuk menggunakan pendeteksian AI.")) {
                          setApiKey("");
                          setTempApiKey("");
                          localStorage.removeItem("koma_gemini_api_key");
                        }
                      }}
                      className="px-3 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white font-bold text-[10px] rounded-lg transition cursor-pointer border border-rose-500/10"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>

              {/* Theme Settings Card switcher */}
              <div className={`${c.cardBg} rounded-3xl border p-4 shadow-xl`}>
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 mb-2 font-mono">Tampilan & Tema M3</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "charcoal", name: "Pure Charcoal", accent: "bg-indigo-600" },
                    { id: "cobalt", name: "Space Cobalt", accent: "bg-[#2563EB]" },
                    { id: "crimson", name: "Ruby Crimson", accent: "bg-[#E11D48]" },
                    { id: "emerald", name: "Emerald Moss", accent: "bg-[#059669]" },
                    { id: "slate", name: "Steel Slate", accent: "bg-[#0ea5e9]" },
                  ].map((t) => (
                    <button 
                      key={t.id}
                      onClick={() => setTheme(t.id as any)}
                      className={`p-3 rounded-2xl border text-left transition relative overflow-hidden flex items-center gap-2 cursor-pointer ${
                        theme === t.id 
                           ? "border-indigo-500 bg-white/[0.04] shadow-sm font-bold text-white" 
                          : "border-white/5 bg-black/20 hover:bg-black/40 text-white/60"
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${t.accent} shrink-0`} />
                      <span className="text-[11px] truncate">{t.name}</span>
                      {theme === t.id && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bantuan & Panduan Penggunaan Card */}
              <div className={`${c.cardBg} rounded-3xl border p-4 shadow-xl flex items-center justify-between`}>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 font-mono">Bantuan &amp; Panduan</h3>
                  <p className="text-[10px] text-white/40 leading-snug">Pelajari cara memotong &amp; mengunci koordinat panel.</p>
                </div>
                <button 
                  onClick={() => setShowHowTo(true)}
                  className={`px-3.5 py-2 hover:opacity-90 active:scale-95 text-[10px] font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${c.btn}`}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>Panduan</span>
                </button>
              </div>

              {/* Export and reset operations */}
              <div className={`${c.cardBg} rounded-3xl border p-4 shadow-xl space-y-3`}>
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 mb-2 font-mono font-bold">Opsi Ekspor & Riwayat</h3>
                
                <div className="space-y-2">
                  <button 
                    onClick={() => {
                      // export coordinates maps
                      const payload = pages.map(p => ({
                        page_name: p.name,
                        page_width_px: p.width,
                        page_height_px: p.height,
                        boxes_count: p.panels.length,
                        panels: p.panels.map(pan => ({
                          order: pan.reading_order_level,
                          box_2d: pan.box_2d,
                          label: pan.position_name,
                          annotation: pan.description
                        }))
                      }));
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `annotation_metadata_${Date.now()}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    disabled={pages.length === 0}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 disabled:opacity-20 text-[#E4E4E7] text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-white/5 cursor-pointer shadow-sm"
                  >
                    <span>Ekspor Metadata JSON</span>
                  </button>

                  <button 
                    onClick={handleResetApplication}
                    className="w-full py-2.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-rose-500/10 cursor-pointer shadow-sm transition"
                  >
                    <span>Form Hapus Data Sinyal</span>
                  </button>
                </div>
              </div>

              {/* simulated developers diagnostic specs */}
              <div className="bg-black/40 border border-zinc-850 p-3 rounded-2xl space-y-1 text-[10px] font-mono text-white/30 text-left shrink-0">
                <p>NATIVE_RENDER_AGENT: WEB_STANDALONE</p>
                <p>STATUS_IMMERSIVE: REQUEST_SUCCESS</p>
                <p>GPU_ENGINE: WEBGL_V3_ACCELERATED</p>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* 5. Android Bottom Navigation Bar */}
      <footer className={`h-16 pt-1 flex items-center justify-around shadow-xl ${c.bottomNav} border-t shrink-0 z-40 select-none pb-safe`}>
        <button 
          id="btn-nav-home"
          onClick={() => setActiveTab("home")}
          className="flex flex-col items-center justify-center w-16 h-full cursor-pointer relative group transition active:scale-95"
        >
          <div className={`p-1.5 rounded-full px-4 transition-all duration-150 flex items-center justify-center ${
            activeTab === "home" ? "bg-indigo-600/30 text-indigo-400 border border-indigo-500/20" : "text-white/45 group-hover:text-white"
          }`}>
            <Home className="h-5 w-5" />
          </div>
          <span className={`text-[10px] transition-colors mt-1 font-bold ${activeTab === "home" ? "text-indigo-400 font-bold" : "text-white/45"}`}>
            Home
          </span>
        </button>

        <button 
          id="btn-nav-workspace"
          onClick={() => setActiveTab("workspace")}
          className="flex flex-col items-center justify-center w-16 h-full cursor-pointer relative group transition active:scale-95"
        >
          <div className={`p-1.5 rounded-full px-4 transition-all duration-150 flex items-center justify-center ${
            activeTab === "workspace" ? "bg-indigo-600/30 text-indigo-400 border border-indigo-500/20" : "text-white/45 group-hover:text-white"
          }`}>
            <Layers className="h-5 w-5" />
          </div>
          <span className={`text-[10px] transition-colors mt-1 font-bold ${activeTab === "workspace" ? "text-indigo-400 font-bold" : "text-white/45"}`}>
            Workspace
          </span>
        </button>

        <button 
          id="btn-nav-panels"
          onClick={() => setActiveTab("panels")}
          className="flex flex-col items-center justify-center w-16 h-full cursor-pointer relative group transition active:scale-95"
        >
          <div className={`p-1.5 rounded-full px-4 transition-all duration-150 flex items-center justify-center relative ${
            activeTab === "panels" ? "bg-indigo-600/30 text-indigo-400 border border-indigo-500/20" : "text-white/45 group-hover:text-white"
          }`}>
            <ImageIcon className="h-5 w-5" />
            {flatPanelList.length > 0 && (
              <span className="absolute top-0 right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-black animate-bounce">
                {flatPanelList.length}
              </span>
            )}
          </div>
          <span className={`text-[10px] transition-colors mt-1 font-bold ${activeTab === "panels" ? "text-indigo-400 font-bold" : "text-white/45"}`}>
            Panels
          </span>
        </button>

        <button 
          id="btn-nav-settings"
          onClick={() => setActiveTab("settings")}
          className="flex flex-col items-center justify-center w-16 h-full cursor-pointer relative group transition active:scale-95"
        >
          <div className={`p-1.5 rounded-full px-4 transition-all duration-150 flex items-center justify-center ${
            activeTab === "settings" ? "bg-indigo-600/30 text-indigo-400 border border-indigo-500/20" : "text-white/45 group-hover:text-white"
          }`}>
            <SettingsIcon className="h-5 w-5" />
          </div>
          <span className={`text-[10px] transition-colors mt-1 font-bold ${activeTab === "settings" ? "text-indigo-400 font-bold" : "text-white/45"}`}>
            Settings
          </span>
        </button>
      </footer>
    </div>
  );
}
