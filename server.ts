import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { Agent, setGlobalDispatcher } from "undici";

// Configure undici global dispatcher to support larger timeout thresholds for heavy Gemini API processing.
// This prevents HeadersTimeoutError / fetch failed errors when processing high-resolution images.
const globalAgent = new Agent({
  headersTimeout: 300000, // 5 minutes
  bodyTimeout: 300000,    // 5 minutes
  connectTimeout: 60000,  // 60 seconds
});
setGlobalDispatcher(globalAgent);

dotenv.config();

const app = express();
const PORT = 3000;

// Set high limits for base64 uploads (manga sheets can be high res)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(customKey?: string): GoogleGenAI {
  const key = customKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Google AI Studio API Key tidak ditemukan. Silakan masukkan API Key yang valid pada layar masuk atau pengaturan aplikasi.");
  }
  
  if (!customKey && aiInstance) {
    return aiInstance;
  }

  const client = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  if (!customKey) {
    aiInstance = client;
  }

  return client;
}

// API endpoints
app.post("/api/detect-panels", async (req, res) => {
  try {
    const { image, mimeType, apiKey } = req.body;
    const headerKey = req.headers["x-gemini-api-key"] as string;
    const customKey = headerKey || apiKey;

    if (!image) {
      return res.status(400).json({ error: "Missing image data in request body." });
    }

    // Isolate base64 data (clear data URL prefix if any)
    let base64Data = image;
    let actualMimeCode = mimeType || "image/jpeg";

    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        actualMimeCode = match[1];
        base64Data = match[2];
      }
    }

    const ai = getGeminiClient(customKey);

    const imagePart = {
      inlineData: {
        mimeType: actualMimeCode,
        data: base64Data,
      },
    };

    const promptText = "Analyze this manga/comic page image and identify all individual panel frames/boundaries. " +
      "Find every panel box completely, including small, flashback, or full-page panels. " +
      "Sort the panels strictly in the traditional Japanese manga reading order, which goes from TOP-RIGHT to LEFT, and then ROW-BY-ROW downwards. " +
      "Return the bounding box coordinates normalized to a range of 0 to 1000 representing [ymin, xmin, ymax, xmax] where top-left is [0, 0] and bottom-right is [1000, 1000]. " +
      "ymin is the top edge, xmin is the left edge, ymax is the bottom edge, xmax is the right edge. " +
      "Also provide a short visual description of the drawing inside each panel so we can identify them.";

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [imagePart, promptText],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            panels: {
              type: Type.ARRAY,
              description: "A list of comic pane bounding boxes found on the page in manga reading order (top-right to bottom-left).",
              items: {
                type: Type.OBJECT,
                properties: {
                  box_2d: {
                    type: Type.ARRAY,
                    description: "An array of 4 integers [ymin, xmin, ymax, xmax] in relative coordinate space where coordinates are integers from 0 to 1000.",
                    items: {
                      type: Type.INTEGER
                    }
                  },
                  description: {
                    type: Type.STRING,
                    description: "A 1-sentence description of the visual scene inside this panel (e.g. 'Character looking back, surprised')."
                  },
                  position_name: {
                    type: Type.STRING,
                    description: "Position descriptor relative to the board layout (e.g. 'Top-Right', 'Middle-Left', etc.)."
                  },
                  reading_order_level: {
                    type: Type.INTEGER,
                    description: "Relative rank of sequence starting from 1."
                  }
                },
                required: ["box_2d", "description", "position_name", "reading_order_level"]
              }
            }
          },
          required: ["panels"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      return res.status(500).json({ error: "Empty response received from the Gemini AI model." });
    }

    try {
      const parsedData = JSON.parse(text);
      return res.json(parsedData);
    } catch (parseError: any) {
      console.error("Failed to parse JSON reply:", text);
      return res.status(500).json({ error: "Gemini did not return valid JSON.", rawText: text });
    }

  } catch (error: any) {
    console.error("Error detecting panels:", error);
    return res.status(500).json({ error: error.message || "An unknown error occured during panel analysis." });
  }
});

// Vite middleware setup
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind port 3000 as explicitly required
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

start();
