import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import mysql from "mysql2/promise";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "cinode-secret-key";

// Media Directories
const MOVIES_DIR = process.env.MOVIES_DIR || "/DATA/Media/Movies";
const TV_DIR = process.env.TV_DIR || "/DATA/Media/TV";

const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".webm", ".avi", ".m4v", ".mov", ".flv", ".wmv"];

function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (ifaceList) {
      for (const iface of ifaceList) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  return "0.0.0.0";
}

// Ensure directories exist
if (!fs.existsSync(MOVIES_DIR) || !fs.existsSync(TV_DIR)) {
  console.warn(`⚠️ Media directories not found. Movies: ${MOVIES_DIR}, TV: ${TV_DIR}`);
}

app.use(express.json());

// Database Setup
let pool: mysql.Pool | null = null;
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cinode",
};

async function initDB() {
  try {
    pool = mysql.createPool(dbConfig);
    // Test connection
    await pool.getConnection();
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        theme VARCHAR(50) DEFAULT 'bento',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Force add columns if table existed without them (brute force migration)
    try { await pool.query("ALTER TABLE users ADD COLUMN username VARCHAR(255) UNIQUE NOT NULL AFTER id"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL AFTER username"); } catch (e) {}
    try { await pool.query("ALTER TABLE users ADD COLUMN theme VARCHAR(50) DEFAULT 'bento' AFTER password"); } catch (e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        media_id VARCHAR(255) NOT NULL,
        media_type ENUM('movie', 'tv') NOT NULL,
        title VARCHAR(255),
        poster VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY user_media (user_id, media_id, media_type)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        media_id VARCHAR(255) NOT NULL,
        media_type ENUM('movie', 'tv') NOT NULL,
        title VARCHAR(255),
        episode VARCHAR(255),
        watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS metadata (
        media_id VARCHAR(255) PRIMARY KEY,
        media_type ENUM('movie', 'tv') NOT NULL,
        plot TEXT,
        cast TEXT,
        director VARCHAR(255),
        rating DECIMAL(3,1),
        year INT,
        genres VARCHAR(255),
        runtime VARCHAR(50),
        backdrop VARCHAR(255),
        poster VARCHAR(255)
      )
    `);

    try {
      const [mCols]: any = await pool.query("SHOW COLUMNS FROM metadata");
      const mColNames = mCols.map((c: any) => c.Field);
      if (!mColNames.includes('poster')) {
        await pool.query("ALTER TABLE metadata ADD COLUMN poster VARCHAR(255)");
      }
    } catch (e) {
      console.warn("Metadata verification failed:", e);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS playback_progress (
        user_id INT NOT NULL,
        media_id VARCHAR(255) NOT NULL,
        media_type ENUM('movie', 'tv') NOT NULL,
        episode_id VARCHAR(255),
        position_seconds INT DEFAULT 0,
        duration_seconds INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, media_id, media_type, episode_id)
      )
    `);

    console.log("✅ MySQL Database Initialized with Advanced Schema");
  } catch (error) {
    console.warn("⚠️ MySQL Connection Failed. Please provide credentials in environment variables.");
    console.warn("Falling back to in-memory store for this session.");
    pool = null;
  }
}

// Mock Storage (Fallback)
const mockUsers: any[] = [];
const mockWatchlists: Record<number, any[]> = {};
const mockHistory: Record<number, any[]> = {};
const mockMetadata: Record<string, any> = {};
const mockProgress: Record<string, any> = {};

// --- Helper: Metadata Fetcher ---
async function getEnhancedMetadata(mediaId: string, type: string, titleHint: string) {
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  
  if (pool) {
    const [rows]: any = await pool.query("SELECT * FROM metadata WHERE media_id = ?", [mediaId]);
    if (rows.length > 0) return rows[0];
  } else if (mockMetadata[mediaId]) {
    return mockMetadata[mediaId];
  }

  let metadata = {
    media_id: mediaId,
    media_type: type,
    plot: `In a world of high-stakes digital espionage, ${titleHint} follows a small band of resistance fighters uncovering a conspiracy that could reset humanity.`,
    cast: "Caleb McLaughlin, Florence Pugh, Lakeith Stanfield",
    director: "Denis Villeneuve",
    rating: 8.4,
    year: 2024,
    genres: "Sci-Fi, Action, Thriller",
    runtime: "2h 14m",
    backdrop: `https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2000&auto=format&fit=crop`,
    poster: `https://images.unsplash.com/photo-1542204111-97b779407ec7?q=80&w=400&h=600&auto=format&fit=crop`
  };

  if (TMDB_API_KEY) {
    try {
      const searchType = type === 'movie' ? 'movie' : 'tv';
      const searchUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(titleHint)}`;
      const searchRes = await fetch(searchUrl);
      const searchData: any = await searchRes.json();

      if (searchData.results && searchData.results.length > 0) {
        const bestMatch = searchData.results[0];
        const detailsUrl = `https://api.themoviedb.org/3/${searchType}/${bestMatch.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
        const detailsRes = await fetch(detailsUrl);
        const details: any = await detailsRes.json();

        metadata = {
          media_id: mediaId,
          media_type: type,
          plot: details.overview || metadata.plot,
          cast: details.credits?.cast?.slice(0, 5).map((c: any) => c.name).join(", ") || metadata.cast,
          director: details.credits?.crew?.find((c: any) => c.job === 'Director')?.name || metadata.director,
          rating: details.vote_average || metadata.rating,
          year: parseInt((details.release_date || details.first_air_date || "2024").substring(0, 4)),
          genres: details.genres?.map((g: any) => g.name).join(", ") || metadata.genres,
          runtime: details.runtime ? `${details.runtime}m` : (details.episode_run_time ? `${details.episode_run_time[0]}m` : metadata.runtime),
          backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : metadata.backdrop,
          poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : metadata.poster
        } as any;
      }
    } catch (e) {
      console.warn("TMDB Fetch Failed:", e);
    }
  }

  if (pool) {
    await pool.query("INSERT INTO metadata (media_id, media_type, plot, cast, director, rating, year, genres, runtime, backdrop, poster) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE plot=VALUES(plot), backdrop=VALUES(backdrop), poster=VALUES(poster)", 
      [metadata.media_id, metadata.media_type, metadata.plot, metadata.cast, metadata.director, metadata.rating, metadata.year, metadata.genres, metadata.runtime, metadata.backdrop, (metadata as any).poster]
    ).catch(err => console.error("Metadata save failed:", err));
  } else {
    mockMetadata[mediaId] = metadata;
  }
  return metadata;
}

// --- Auth Middleware ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) return res.status(401).json({ message: "Authentication required" });

  jwt.verify(token as string, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: "Invalid session" });
    req.user = user;
    next();
  });
};

// --- Auth Routes ---
app.post("/api/auth/signup", async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  
  try {
    if (pool) {
      await pool.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashed]);
    } else {
      if (mockUsers.find(u => u.username === username)) return res.status(400).json({ message: "Username exists" });
      mockUsers.push({ id: Date.now(), username, password: hashed, theme: 'bento' });
    }
    res.json({ message: "Sign up successful" });
  } catch (e: any) {
    console.error("Registration Error:", e);
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: "Username already taken" });
    }
    res.status(500).json({ message: "Sign up failed: " + e.message });
  }
});

app.post("/api/auth/signin", async (req, res) => {
  const { username, password } = req.body;
  try {
    let user: any;
    if (pool) {
      const [rows]: any = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
      user = rows[0];
    } else {
      user = mockUsers.find(u => u.username === username);
    }

    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username,
        theme: user.theme || 'bento'
      } 
    });
  } catch (error) {
    res.status(500).json({ message: "Sign in failed" });
  }
});

// Profile & Preferences
app.get("/api/profile", authenticateToken, async (req: any, res) => {
  try {
    if (pool) {
      const [rows]: any = await pool.query("SELECT id, username, theme FROM users WHERE id = ?", [req.user.id]);
      res.json(rows[0]);
    } else {
      const user = mockUsers.find(u => u.id === req.user.id);
      res.json({ id: user.id, username: user.username, theme: user.theme || 'bento' });
    }
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

app.post("/api/profile/theme", authenticateToken, async (req: any, res) => {
  const { theme } = req.body;
  try {
    if (pool) {
      await pool.query("UPDATE users SET theme = ? WHERE id = ?", [theme, req.user.id]);
    } else {
      const user = mockUsers.find(u => u.id === req.user.id);
      if (user) user.theme = theme;
    }
    res.json({ message: "Theme updated" });
  } catch (e) {
    res.status(500).json({ message: "Failed to update theme" });
  }
});

// Watchlist
app.get("/api/watchlist", authenticateToken, async (req: any, res) => {
  try {
    if (pool) {
      const [rows]: any = await pool.query("SELECT * FROM watchlist WHERE user_id = ? ORDER BY created_at DESC", [req.user.id]);
      res.json(rows);
    } else {
      const list = mockWatchlists[req.user.id] || [];
      res.json(list);
    }
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch watchlist" });
  }
});

app.post("/api/watchlist/toggle", authenticateToken, async (req: any, res) => {
  const { media_id, media_type, title, poster } = req.body;
  try {
    if (pool) {
      const [existing]: any = await pool.query("SELECT id FROM watchlist WHERE user_id = ? AND media_id = ? AND media_type = ?", [req.user.id, media_id, media_type]);
      if (existing.length > 0) {
        await pool.query("DELETE FROM watchlist WHERE id = ?", [existing[0].id]);
        res.json({ action: "removed" });
      } else {
        await pool.query("INSERT INTO watchlist (user_id, media_id, media_type, title, poster) VALUES (?, ?, ?, ?, ?)", [req.user.id, media_id, media_type, title, poster]);
        res.json({ action: "added" });
      }
    } else {
      if (!mockWatchlists[req.user.id]) mockWatchlists[req.user.id] = [];
      const list = mockWatchlists[req.user.id];
      const idx = list.findIndex((m: any) => m.media_id === media_id && m.media_type === media_type);
      if (idx > -1) {
        list.splice(idx, 1);
        res.json({ action: "removed" });
      } else {
        list.push({ media_id, media_type, title, poster });
        res.json({ action: "added" });
      }
    }
  } catch (e) {
    res.status(500).json({ message: "Failed to toggle watchlist" });
  }
});

// History
app.get("/api/history", authenticateToken, async (req: any, res) => {
  try {
    if (pool) {
      const [rows]: any = await pool.query("SELECT * FROM history WHERE user_id = ? ORDER BY watched_at DESC LIMIT 50", [req.user.id]);
      res.json(rows);
    } else {
      res.json(mockHistory[req.user.id] || []);
    }
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

app.post("/api/history/add", authenticateToken, async (req: any, res) => {
  const { media_id, media_type, title, episode } = req.body;
  try {
    if (pool) {
      await pool.query("INSERT INTO history (user_id, media_id, media_type, title, episode) VALUES (?, ?, ?, ?, ?)", [req.user.id, media_id, media_type, title, episode]);
    } else {
      if (!mockHistory[req.user.id]) mockHistory[req.user.id] = [];
      mockHistory[req.user.id].unshift({ media_id, media_type, title, episode, watched_at: new Date() });
    }
    res.json({ message: "History recorded" });
  } catch (e) {
    res.status(500).json({ message: "Failed to add history" });
  }
});

// Progress Routes
app.get("/api/progress", authenticateToken, async (req: any, res) => {
  try {
    if (pool) {
      const [rows]: any = await pool.query("SELECT * FROM playback_progress WHERE user_id = ?", [req.user.id]);
      res.json(rows);
    } else {
      res.json(Object.values(mockProgress).filter((p: any) => p.user_id === req.user.id));
    }
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

app.post("/api/progress", authenticateToken, async (req: any, res) => {
  const { media_id, media_type, episode_id, position_seconds, duration_seconds } = req.body;
  const eid = episode_id || 'null';
  try {
    if (pool) {
      await pool.query(`
        INSERT INTO playback_progress (user_id, media_id, media_type, episode_id, position_seconds, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE position_seconds = VALUES(position_seconds), duration_seconds = VALUES(duration_seconds)
      `, [req.user.id, media_id, media_type, eid, position_seconds, duration_seconds]);
    } else {
      const key = `${req.user.id}-${media_id}-${eid}`;
      mockProgress[key] = { user_id: req.user.id, media_id, media_type, episode_id: eid, position_seconds, duration_seconds };
    }
    res.json({ status: "ok" });
  } catch (e) {
    res.status(500).json({ error: "Failed to save progress" });
  }
});

// Media Routes (Protected)
app.get("/api/movies", authenticateToken, async (req, res) => {
  try {
    if (!fs.existsSync(MOVIES_DIR)) return res.json([]);
    const entries = fs.readdirSync(MOVIES_DIR).filter(f => !f.startsWith("."));
    const moviesList: any[] = [];

    for (const entry of entries) {
      const fullPath = path.join(MOVIES_DIR, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isFile()) {
        const ext = path.extname(entry).toLowerCase();
        if (VIDEO_EXTENSIONS.includes(ext)) {
          moviesList.push({ id: entry, title: entry.replace(/\.[^/.]+$/, "").replace(/[._-]/g, " "), file: entry });
        }
      } else if (stat.isDirectory()) {
        // Look for any video file inside
        const subFiles = fs.readdirSync(fullPath).filter(f => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()));
        if (subFiles.length > 0) {
          moviesList.push({ id: entry, title: entry.replace(/[._-]/g, " "), file: path.join(entry, subFiles[0]) });
        }
      }
    }

    const movies = await Promise.all(moviesList.map(async m => {
      const meta = await getEnhancedMetadata(m.id, "movie", m.title);
      return {
        ...m,
        poster: meta.poster || null,
        metadata: meta
      };
    }));
    res.json(movies);
  } catch (e) {
    console.error("Movie Scan Error:", e);
    res.status(500).json({ message: "Failed to scan movies" });
  }
});

app.get("/api/tv", authenticateToken, async (req, res) => {
  try {
    if (!fs.existsSync(TV_DIR)) return res.json([]);
    const folders = fs.readdirSync(TV_DIR).filter(f => {
      const fullPath = path.join(TV_DIR, f);
      return fs.statSync(fullPath).isDirectory() && !f.startsWith(".");
    });
    const shows = await Promise.all(folders.map(async f => {
      const id = f;
      const title = f.replace(/[._-]/g, " ");
      const meta = await getEnhancedMetadata(id, "tv", title);
      return {
        id,
        title,
        poster: meta.poster || null,
        folder: f,
        metadata: meta
      };
    }));
    res.json(shows);
  } catch (e) {
    console.error("TV Scan Error:", e);
    res.status(500).json({ message: "Failed to scan TV shows" });
  }
});

app.get("/api/tv/:id", authenticateToken, async (req, res) => {
  try {
    const showPath = path.join(TV_DIR, req.params.id);
    if (!fs.existsSync(showPath)) return res.status(404).json({ message: "Show not found" });

    const seasons: Record<string, string[]> = {};
    
    function findVideos(dir: string, relativePrefix: string = "") {
      const entries = fs.readdirSync(dir).filter(f => !f.startsWith("."));
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const relPath = relativePrefix ? path.join(relativePrefix, entry) : entry;
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          findVideos(fullPath, relPath);
        } else if (stat.isFile() && VIDEO_EXTENSIONS.includes(path.extname(entry).toLowerCase())) {
          // Determine season
          let season = "1";
          const seasonMatch = relPath.match(/Season\s*(\d+)/i) || relPath.match(/S(\d+)/i);
          if (seasonMatch) season = parseInt(seasonMatch[1]).toString();
          
          if (!seasons[season]) seasons[season] = [];
          seasons[season].push(relPath);
        }
      }
    }

    findVideos(showPath);
    
    res.json({
      show: req.params.id,
      seasons
    });
  } catch (e) {
    console.error("TV Show Details Error:", e);
    res.status(500).json({ message: "Failed to load show details" });
  }
});

app.get("/api/subtitles/:type/:id/:episode?", authenticateToken, (req: any, res) => {
  const { type, id, episode } = req.params;
  const baseDir = type === "movie" ? MOVIES_DIR : path.join(TV_DIR, id);
  const mediaFile = type === "movie" ? id : episode;
  
  if (!mediaFile) return res.status(400).json({ error: "Missing file" });

  const mediaBase = mediaFile.substring(0, mediaFile.lastIndexOf("."));
  
  const subExtensions = [".vtt", ".srt", ".en.vtt", ".en.srt"];
  for (const ext of subExtensions) {
    const subPath = path.join(baseDir, mediaBase + ext);
    if (fs.existsSync(subPath)) {
      return res.sendFile(subPath);
    }
  }
  
  res.status(404).json({ error: "No subtitles found" });
});

app.get("/api/stream/movie/*", authenticateToken, (req, res) => {
  const filePath = path.join(MOVIES_DIR, (req.params as any)[0]);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

app.get("/api/stream/tv/:id/*", authenticateToken, (req, res) => {
  const filePath = path.join(TV_DIR, req.params.id, (req.params as any)[0]);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ message: "File not found" });
  }
});

// Vite Middleware
async function startServer() {
  await initDB();
  
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

  app.listen(PORT, "0.0.0.0", () => {
    const networkIP = getNetworkIP();
    console.log(`\n\x1b[32m  ➜  \x1b[1mCinode Server\x1b[0m: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[32m  ➜  \x1b[1mNetwork Access\x1b[0m: \x1b[36mhttp://${networkIP}:${PORT}\x1b[0m`);
    console.log(`\x1b[33m  ℹ  Note: To access worldwide, ensure port ${PORT} is open in your VPS firewall (e.g., sudo ufw allow ${PORT}).\x1b[0m\n`);
  });
}

startServer();
