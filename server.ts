import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Configure multer to save uploaded videos to a secure OS temp folder
const uploadDir = path.join(os.tmpdir(), "viral-seo-smm-temp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit for video files
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".mp4") {
      return cb(new Error("Only .mp4 video files are accepted."));
    }
    cb(null, true);
  },
});

// Parse body keys
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Robustly parses a JSON string, stripping any potential markdown wrappers, conversational
 * padding or unescaped control characters so that the SMM draft is never broken.
 */
function parseModelResponseRobustly(text: string): { title: string; description: string; hashtags: string[] } {
  let cleanedText = text.trim();
  
  // 1. Strip markdown codeblocks
  if (cleanedText.startsWith("```")) {
    const match = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      cleanedText = match[1].trim();
    }
  }

  // Find actual JSON boundaries
  const firstBrace = cleanedText.indexOf("{");
  const lastBrace = cleanedText.lastIndexOf("}");
  let jsonString = cleanedText;
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonString);
    return {
      title: parsed.title || "Untitled SEO Campaign",
      description: parsed.description || "No description generated.",
      hashtags: Array.isArray(parsed.hashtags) 
        ? parsed.hashtags 
        : typeof parsed.hashtags === "string"
          ? parsed.hashtags.split(/[,\s]+/).filter(Boolean)
          : []
    };
  } catch (err) {
    console.warn("[SEO API] Standard JSON.parse failed on model text, resorting to heuristic regex parsing:", err);
    
    // Heuristic regex backup parsing
    let title = "Untitled SEO Campaign";
    const titleRegex = /"title"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"description"|\s*,\s*"hashtags"|\s*\})/i;
    const titleMatch = jsonString.match(titleRegex);
    if (titleMatch) {
      title = titleMatch[1];
    }

    // Capture description
    let description = "No description generated.";
    const descRegex = /"description"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"hashtags"|\s*,\s*"title"|\s*\})/i;
    const descMatch = jsonString.match(descRegex);
    if (descMatch) {
      description = descMatch[1];
    } else {
      const fallbackDescRegex = /"description"\s*:\s*"([\s\S]*?)"/i;
      const fallbackDescMatch = jsonString.match(fallbackDescRegex);
      if (fallbackDescMatch) {
        description = fallbackDescMatch[1];
      }
    }

    // Capture hashtags
    let hashtags: string[] = [];
    const hashRegex = /"hashtags"\s*:\s*\[([\s\S]*?)\]/i;
    const hashMatch = jsonString.match(hashRegex);
    if (hashMatch) {
      const arrayContent = hashMatch[1];
      const tags = arrayContent.match(/"([^"]+)"/g);
      if (tags) {
        hashtags = tags.map(t => t.slice(1, -1).trim());
      }
    }

    // Unescape common JSON escapes
    const unescapeJsonString = (str: string) => {
      return str
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, "\\")
        .replace(/\\t/g, "\t");
    };

    return {
      title: unescapeJsonString(title),
      description: unescapeJsonString(description),
      hashtags: hashtags.map(h => h.startsWith("#") ? h : `#${h}`)
    };
  }
}

/**
 * Wraps an asynchronous action with automatic retries and exponential backoff.
 * Especially useful for handling transient 503 (temporary high demand) and 429 (rate-limit) exceptions.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  onRetry: (err: any, attempt: number, nextDelayMs: number) => void,
  maxAttempts = 3,
  initialDelayMs = 1500
): Promise<T> {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const errString = String(err?.message || err);
      const isPermanentQuotaZero = errString.includes("limit: 0");
      const isTemporary =
        !isPermanentQuotaZero && (
          err?.status === 503 ||
          err?.status === 429 ||
          err?.code === 503 ||
          err?.code === 429 ||
          errString.includes("503") ||
          errString.includes("429") ||
          errString.includes("UNAVAILABLE") ||
          errString.includes("RESOURCE_EXHAUSTED") ||
          errString.includes("experiencing high demand") ||
          errString.includes("temporary")
        );

      if (attempt === maxAttempts || !isTemporary) {
        throw err;
      }

      onRetry(err, attempt, delay);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff scaling
    }
  }
  throw new Error("Maximum retry attempts exceeded.");
}

// Serve API routes first
app.post("/api/analyze-video", upload.single("video"), async (req: Request, res: Response) => {
  const file = req.file;
  const rawTone = req.body.tone || "standard";
  const customContext = req.body.context || "";

  if (!file) {
    res.status(400).json({ error: "No video file uploaded." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Delete temp file quickly to protect space
    try {
      fs.unlinkSync(file.path);
    } catch (_) {}
    res.status(500).json({
      error: "Gemini API key is not configured. Please add GEMINI_API_KEY to your Secrets.",
    });
    return;
  }

  // Initialize official SDK
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  let uploadResult: any = null;

  try {
    console.log(`[SEO API] Received file: ${file.originalname} (${file.size} bytes). Uploading to Gemini File API...`);

    // Upload using Gemini File Storage API
    uploadResult = await ai.files.upload({
      file: file.path,
      config: {
        mimeType: file.mimetype || "video/mp4",
      },
    });

    console.log(`[SEO API] Upload success. File URI: ${uploadResult.uri}. Waiting for processing...`);

    // Wait until the file transitions from PROCESSING to ACTIVE
    let fileInfo = await ai.files.get({ name: uploadResult.name });
    let attempts = 0;
    while (fileInfo.state === "PROCESSING" && attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      fileInfo = await ai.files.get({ name: uploadResult.name });
      attempts++;
    }

    if (fileInfo.state !== "ACTIVE") {
      throw new Error(`Video processing failed on Google servers. Final state: ${fileInfo.state}`);
    }

    console.log("[SEO API] Video file is ACTIVE. Crafting Gemini multimodal prompt...");

    // Build the Tone instructions based on user selected type
    let tonePrompt = "";
    if (rawTone === "wholesale") {
      tonePrompt = "IMPORTANT TONE: Professional, wholesale-focused, business-to-business (B2B), highlighting superior bulk product quality, materials/textiles, manufacturing standards, large volume capacity, and wholesale trust-building.";
    } else if (rawTone === "real-estate") {
      tonePrompt = "IMPORTANT TONE: Premium, informative, luxury lifestyle and investment-focused. Highlight outstanding physical architecture, scale, property layouts, high-value visual aspects, prestige, premium convenience, and return on investment.";
    } else if (rawTone === "culinary") {
      tonePrompt = "IMPORTANT TONE: Elegant, highly sensory, experiential, aesthetic, and welcoming. Highlight the exquisite culinary details, dynamic bar energy, premium texture of dishes/drinks, atmosphere, presentation, and curated hospitality.";
    } else {
      tonePrompt = "IMPORTANT TONE: Engaging, standard viral consumer-focused tone, balancing clickability with high-quality SEO best practices suitable for generic social campaigns.";
    }

    const systemInstruction = `You are an elite, world-class Social Media Manager and SEO Expert.
analyze the visual frames, on-screen text, any spoken audio, background music, captions, graphics, and full multi-sensory themes of the uploaded video to construct a comprehensive context.

${tonePrompt}

Additional user instruction / context to integrate if provided:
"${customContext}"

Execute high-quality copywriting and strict technical optimization. Your response MUST be a single, flat JSON matches the requested responseSchema. DO NOT wrap output in markdown symbols or return any other text.`;

    const promptMessage = `Identify structural themes, sound effects, on-screen text, visual styling, and narrative in this video.
Generate:
1. A highly clickable, catchy, algorithm-friendly title designed to maximize views, click-through, and retention.
2. A search-optimized, beautiful profile/video description containing relevant storytelling hooks, key insights, call-to-actions, and visually integrated emojis.
3. 15 to 20 highly relevant, trending, discoverable hashtags optimized for social platforms (starting with #).

Analyze the attached video deeply and construct the requested JSON.`;

    const modelCandidates = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-3.1-pro-preview"];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of modelCandidates) {
      try {
        console.log(`[SEO API] Attempting video analysis with model: ${modelName}`);
        response = await withRetry(
          () => ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    fileData: {
                      fileUri: uploadResult.uri,
                      mimeType: uploadResult.mimeType || file.mimetype || "video/mp4",
                    },
                  },
                  { text: promptMessage },
                ],
              }
            ],
            config: {
              systemInstruction,
              temperature: 0.8,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: "The viral, SEO-optimized hook title.",
                  },
                  description: {
                    type: Type.STRING,
                    description: "Beautifully formatted description containing hooks, call-to-actions, and structured bullet details (with suitable emojis).",
                  },
                  hashtags: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.STRING,
                    },
                    description: "A flat array of 15 to 20 highly relevant trending search hashtags.",
                  },
                },
                required: ["title", "description", "hashtags"],
              },
            },
          }),
          (err, attempt, nextDelayMs) => {
            console.warn(
              `[SEO API] Gemini API using ${modelName} is currently experiencing a temporary demand spike or rate limit (Attempt ${attempt}/3 failed). ` +
              `Retrying in ${nextDelayMs}ms... Error details:`, err?.message || err
            );
          },
          3
        );
        if (response) {
          console.log(`[SEO API] Successfully generated content using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`[SEO API] Model ${modelName} failed entirely. Error:`, err?.message || err);
        lastError = err;
      }
    }

    if (!response) {
      throw lastError || new Error("All attempts with candidate models failed due to persistent demand spikes.");
    }

    const outputText = response.text;
    console.log("[SEO API] Raw response output received:", outputText);

    if (!outputText) {
      throw new Error("No output was generated by the model.");
    }

    const parsedJson = parseModelResponseRobustly(outputText);
    console.log("[SEO API] Successfully parsed analysis results:", parsedJson);
    res.json(parsedJson);

  } catch (error: any) {
    console.error("[SEO API] Error processing video analysis:", error);
    res.status(500).json({
      error: "Failed to analyze video because of a server-side error.",
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    // 1. Clean up local uploaded file
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log("[SEO API] Cleaned up local temporary file.");
      }
    } catch (cleanupErr) {
      console.warn("Could not delete local file:", cleanupErr);
    }

    // 2. Clean up file on the Gemini File API to release space
    if (uploadResult && uploadResult.name) {
      try {
        console.log(`[SEO API] Cleaning up file ${uploadResult.name} on Gemini server...`);
        await ai.files.delete({ name: uploadResult.name });
        console.log("[SEO API] Gemini storage file deleted successfully.");
      } catch (geminiCleanupErr) {
        console.warn("Could not delete file from Gemini Storage server:", geminiCleanupErr);
      }
    }
  }
});

// Global Express error handler to prevent HTML responses for unhandled route/middleware errors
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error("[Server Global Error Handler] Unhandled error:", err);
  // Ensure we don't try to send a response if headers are already sent
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || "An unhandled server-side error occurred.",
    details: err.stack || err,
  });
});

// Configure Vite middleware in development vs hosting static assets in production
async function configureServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[server] Vite middleware attached in dev mode.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[server] Serving built static assets in production mode.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] Server is online at http://localhost:${PORT}`);
  });
}

configureServer().catch((err) => {
  console.error("Failed to start server:", err);
});
