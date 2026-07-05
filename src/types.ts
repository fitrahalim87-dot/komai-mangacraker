export interface MangaPanel {
  id: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized to 1000
  description: string;
  position_name: string;
  reading_order_level: number;
  croppedUrl: string | null;
}

export interface MangaPage {
  id: string;
  name: string;
  url: string; // base64 or object URL
  width: number;
  height: number;
  status: 'idle' | 'analyzing' | 'success' | 'error';
  error: string | null;
  panels: MangaPanel[];
}
