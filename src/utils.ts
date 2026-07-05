import { MangaPanel } from "./types";

/**
 * Crops a panel from a manga page image using an offscreen Canvas.
 * Returns a Promise resolving to a JPEG data URL.
 */
export function cropMangaPanel(imageUrl: string, box_2d: [number, number, number, number]): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const [ymin, xmin, ymax, xmax] = box_2d;

      // Calculate pixel coordinates (normalizing from 0..1000)
      const x = Math.max(0, (xmin / 1000) * img.width);
      const y = Math.max(0, (ymin / 1000) * img.height);
      const width = Math.min(img.width - x, ((xmax - xmin) / 1000) * img.width);
      const height = Math.min(img.height - y, ((ymax - ymin) / 1000) * img.height);

      if (width <= 0 || height <= 0) {
        resolve("");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not construct 2D context"));
        return;
      }

      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      try {
        const croppedUrl = canvas.toDataURL("image/jpeg", 0.9);
        resolve(croppedUrl);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => reject(new Error("Failed to load source image for cropping"));
    img.src = imageUrl;
  });
}

/**
 * Sorts manga panels in Japanese reading order (Right-to-Left, Top-to-Bottom).
 * It groups panels into rows based on vertical overlap, and then sorts each row from Right to Left.
 */
export function sortMangaPanels(panels: MangaPanel[]): MangaPanel[] {
  if (panels.length <= 1) return panels;

  // 1. Calculate centers and heights
  const panelsWithCenters = panels.map(p => {
    const [ymin, xmin, ymax, xmax] = p.box_2d;
    const centerY = (ymin + ymax) / 2;
    const centerX = (xmin + xmax) / 2;
    const height = ymax - ymin;
    return { ...p, centerY, centerX, height, ymin, xmin, ymax, xmax };
  });

  // 2. Sort primary by top edge / center Y
  panelsWithCenters.sort((a, b) => a.centerY - b.centerY);

  // 3. Group into logical rows
  const rows: typeof panelsWithCenters[] = [];
  
  for (const panel of panelsWithCenters) {
    let placed = false;
    for (const row of rows) {
      // Find row vertical average
      const rowAvgY = row.reduce((sum, item) => sum + item.centerY, 0) / row.length;
      const rowAvgHeight = row.reduce((sum, item) => sum + item.height, 0) / row.length;

      // If the vertical center of the panel is within half-average-height of the row, group them
      if (Math.abs(panel.centerY - rowAvgY) < rowAvgHeight * 0.45) {
        row.push(panel);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push([panel]);
    }
  }

  // 4. Sort each row from Right to Left (descending centerX)
  rows.forEach(row => {
    row.sort((a, b) => b.centerX - a.centerX);
  });

  // 5. Sort the rows from Top to Bottom (ascending average Y)
  rows.sort((rowA, rowB) => {
    const avgYA = rowA.reduce((sum, item) => sum + item.centerY, 0) / rowA.length;
    const avgYB = rowB.reduce((sum, item) => sum + item.centerY, 0) / rowB.length;
    return avgYA - avgYB;
  });

  // 6. Project back to normal panels & update sequence levels
  let counter = 1;
  const sortedPanels: MangaPanel[] = [];
  
  rows.forEach(row => {
    row.forEach(item => {
      sortedPanels.push({
        id: item.id,
        box_2d: item.box_2d,
        description: item.description,
        position_name: item.position_name,
        reading_order_level: counter++,
        croppedUrl: item.croppedUrl
      });
    });
  });

  return sortedPanels;
}

/**
 * Generates a high-quality black-and-white mock manga page.
 * Returns a Promise that resolves to a base64 image URL of a standard manga sheet.
 */
export function generateMangaDemoSheet(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 1100;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // 1. Fill white canvas
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Draw border guidelines
  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
  ctx.setLineDash([]);

  // Define panels we're drawing (relative coordinates in range 0..1000)
  // Panel 1: Top-Right (RTL 1st)
  // Panel 2: Top-Left (RTL 2nd)
  // Panel 3: Middle Full-Width (RTL 3rd)
  // Panel 4: Bottom-Right (RTL 4th)
  // Panel 5: Bottom-Left (RTL 5th)
  const drawBoxes = [
    { name: "Panel 1 (Top-Right)", ymin: 60, xmin: 440, ymax: 380, xmax: 940 },
    { name: "Panel 2 (Top-Left)", ymin: 60, xmin: 60, ymax: 380, xmax: 420 },
    { name: "Panel 3 (Middle Full)", ymin: 400, xmin: 60, ymax: 700, xmax: 940 },
    { name: "Panel 4 (Bottom-Right)", ymin: 720, xmin: 510, ymax: 1040, xmax: 940 },
    { name: "Panel 5 (Bottom-Left)", ymin: 720, xmin: 60, ymax: 1040, xmax: 490 },
  ];

  const mapToCanvas = (val: number, isX: boolean) => {
    const size = isX ? canvas.width : canvas.height;
    return (val / 1000) * size;
  };

  // 3. Draw Manga style sketches inside each panel using canvas operations
  drawBoxes.forEach((box, index) => {
    const px = mapToCanvas(box.xmin, true);
    const py = mapToCanvas(box.ymin, false);
    const pw = mapToCanvas(box.xmax, true) - px;
    const ph = mapToCanvas(box.ymax, false) - py;

    // Save context state for clipping inside panel borders
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();

    // Fill white & stroke border
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(px, py, pw, ph);

    // Panel-specific graphics
    if (index === 0) {
      // Panel 1: Top-Right - Dramatic Close-up face
      // Draw hair spikes
      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.1, py);
      ctx.lineTo(px + pw * 0.3, py + ph * 0.5);
      ctx.lineTo(px + pw * 0.45, py);
      ctx.lineTo(px + pw * 0.6, py + ph * 0.45);
      ctx.lineTo(px + pw * 0.7, py);
      ctx.lineTo(px + pw * 0.85, py + ph * 0.5);
      ctx.lineTo(px + pw * 0.95, py);
      ctx.lineTo(px + pw, py + ph);
      ctx.lineTo(px, py + ph);
      ctx.closePath();
      ctx.fill();

      // Sharp Anime Eyes
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 4;
      
      // Right Eye
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.3, py + ph * 0.55);
      ctx.lineTo(px + pw * 0.45, py + ph * 0.58);
      ctx.lineTo(px + pw * 0.32, py + ph * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#111111";
      ctx.fillRect(px + pw * 0.35, py + ph * 0.58, 12, 12);

      // Left Eye
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.6, py + ph * 0.55);
      ctx.lineTo(px + pw * 0.75, py + ph * 0.58);
      ctx.lineTo(px + pw * 0.62, py + ph * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#111111";
      ctx.fillRect(px + pw * 0.65, py + ph * 0.58, 12, 12);

      // Dramatic speedlines from top-right
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2;
      for (let i = 0; i < 15; i++) {
        ctx.beginPath();
        ctx.moveTo(px + pw, py + i * 15);
        ctx.lineTo(px + pw * 0.5 + i * 10, py + ph * 0.3 + i * 20);
        ctx.stroke();
      }
    } else if (index === 1) {
      // Panel 2: Top-Left - Speech Bubble "N-NANI?!"
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 3;

      // Drawing spiky action speech bubble
      ctx.beginPath();
      const cx = px + pw * 0.5;
      const cy = py + ph * 0.55;
      const r = Math.min(pw, ph) * 0.35;
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI * 2) / 16;
        const dist = r * (i % 2 === 0 ? 1 : 1.25);
        const xCoord = cx + Math.cos(angle) * dist;
        const yCoord = cy + Math.sin(angle) * dist;
        if (i === 0) ctx.moveTo(xCoord, yCoord);
        else ctx.lineTo(xCoord, yCoord);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bold Text
      ctx.fillStyle = "#111111";
      ctx.font = "bold 24px 'Space Grotesk', 'Impact', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("N-NANI?!", cx, cy);

      // Background decorative tone stripes
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 1;
      for (let xOffset = 0; xOffset < pw; xOffset += 10) {
        ctx.beginPath();
        ctx.moveTo(px + xOffset, py);
        ctx.lineTo(px + xOffset, py + ph);
        ctx.stroke();
      }
    } else if (index === 2) {
      // Panel 3: Middle - Huge sword slash with action text "SWOOSH!"
      ctx.fillStyle = "#efefef";
      ctx.fillRect(px, py, pw, ph);

      // Dynamic Speedlines spanning horizontally
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        const yCoord = py + Math.random() * ph;
        ctx.moveTo(px + Math.random() * 80, yCoord);
        ctx.lineTo(px + pw - Math.random() * 80, yCoord);
        ctx.stroke();
      }

      // Massive sword slash diagonal stroke
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.1, py + ph * 0.85);
      ctx.quadraticCurveTo(px + pw * 0.5, py + ph * 0.45, px + pw * 0.9, py + ph * 0.15);
      ctx.lineTo(px + pw * 0.88, py + ph * 0.1);
      ctx.quadraticCurveTo(px + pw * 0.48, py + ph * 0.4, px + pw * 0.08, py + ph * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Text "SWOOSH!" sound effect in Katakana style font
      ctx.fillStyle = "#111111";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.font = "bold 44px 'Trebuchet MS', Impact, sans-serif";
      ctx.textAlign = "center";
      ctx.strokeText("Z Z Z H H T ! !", px + pw * 0.48, py + ph * 0.82);
      ctx.fillText("Z Z Z H H T ! !", px + pw * 0.48, py + ph * 0.82);
    } else if (index === 3) {
      // Panel 4: Bottom-Right - Skyline cityscape
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px, py, pw, ph);

      // Sky sun/moon
      ctx.fillStyle = "#eeeeee";
      ctx.beginPath();
      ctx.arc(px + pw * 0.75, py + ph * 0.35, 30, 0, Math.PI * 2);
      ctx.fill();

      // Silhouettes of houses
      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.moveTo(px, py + ph);
      ctx.lineTo(px + pw * 0.2, py + ph * 0.65);
      ctx.lineTo(px + pw * 0.35, py + ph * 0.65);
      ctx.lineTo(px + pw * 0.4, py + ph * 0.75);
      ctx.lineTo(px + pw * 0.65, py + ph * 0.55);
      ctx.lineTo(px + pw * 0.7, py + ph * 0.55);
      ctx.lineTo(px + pw * 0.85, py + ph * 0.7);
      ctx.lineTo(px + pw, py + ph * 0.5);
      ctx.lineTo(px + pw, py + ph);
      ctx.closePath();
      ctx.fill();

      // Street lamp
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.25, py + ph * 0.65);
      ctx.lineTo(px + pw * 0.25, py + ph * 0.8);
      ctx.stroke();
    } else if (index === 4) {
      // Panel 5: Bottom-Left - Anime Character facing away, with sweat drop
      ctx.fillStyle = "#eeeeee";
      ctx.fillRect(px, py, pw, ph);

      // Character body outline back view
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 3;
      
      // Head
      ctx.beginPath();
      ctx.arc(px + pw * 0.5, py + ph * 0.45, 35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Spiky Anime Hair on back of head
      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(px + pw * 0.5, py + ph * 0.45, 35, Math.PI, Math.PI * 2);
      ctx.lineTo(px + pw * 0.62, py + ph * 0.48);
      ctx.lineTo(px + pw * 0.5, py + ph * 0.32);
      ctx.lineTo(px + pw * 0.38, py + ph * 0.48);
      ctx.closePath();
      ctx.fill();

      // Shoulder outline
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.15, py + ph);
      ctx.quadraticCurveTo(px + pw * 0.3, py + ph * 0.7, px + pw * 0.35, py + ph * 0.55);
      ctx.lineTo(px + pw * 0.65, py + ph * 0.55);
      ctx.quadraticCurveTo(px + pw * 0.7, py + ph * 0.7, px + pw * 0.85, py + ph);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sweat drop icon
      ctx.fillStyle = "#66ccff";
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.72, py + ph * 0.32);
      ctx.quadraticCurveTo(px + pw * 0.78, py + ph * 0.38, px + pw * 0.75, py + ph * 0.44);
      ctx.arc(px + pw * 0.7, py + ph * 0.44, 4, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Speech bubble "Ah..."
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(px + pw * 0.3, py + ph * 0.25, 25, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#111111";
      ctx.font = "italic 15px 'Inter', sans-serif";
      ctx.fillText("Ah...", px + pw * 0.3, py + ph * 0.25);
    }

    ctx.restore();

    // 4. Draw robust borders for panels (standard comic lines)
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = index === 2 ? 6 : 4; // Panel 3 has thick slash action frame
    ctx.strokeRect(px, py, pw, ph);
  });

  return canvas.toDataURL("image/jpeg", 0.95);
}
