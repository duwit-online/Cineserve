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
import OpenSubtitles from "opensubtitles-api";
import srt2vtt from "srt-to-vtt";

const OS = new OpenSubtitles({
    useragent: 'UserAgent',
    ssl: true
});

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
        crew TEXT,
        director VARCHAR(255),
        rating DECIMAL(3,1),
        year INT,
        genres VARCHAR(255),
        runtime VARCHAR(50),
        backdrop VARCHAR(255),
        poster VARCHAR(255),
        tagline VARCHAR(255),
        status VARCHAR(50),
        production_companies TEXT,
        recommendations TEXT,
        file_path TEXT,
        tmdb_id INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    try {
      const [mCols]: any = await pool.query("SHOW COLUMNS FROM metadata");
      const mColNames = mCols.map((c: any) => c.Field);
      const requiredCols = ['crew', 'tagline', 'status', 'production_companies', 'recommendations', 'production_countries', 'file_path', 'tmdb_id'];
      for (const col of requiredCols) {
        if (!mColNames.includes(col)) {
          const type = (col === 'tmdb_id') ? 'INT' : 'TEXT';
          await pool.query(`ALTER TABLE metadata ADD COLUMN ${col} ${type}`);
        }
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
async function getEnhancedMetadata(mediaId: string, type: string, titleHint: string, filePath?: string) {
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  
  if (pool) {
    const [rows]: any = await pool.query("SELECT * FROM metadata WHERE media_id = ?", [mediaId]);
    if (rows.length > 0) {
      const row = rows[0];
      // Update filePath if provided and different
      if (filePath && row.file_path !== filePath) {
        await pool.query("UPDATE metadata SET file_path = ? WHERE media_id = ?", [filePath, mediaId]);
      }
      try {
        if (row.production_companies) row.production_companies = JSON.parse(row.production_companies);
        if (row.recommendations) row.recommendations = JSON.parse(row.recommendations);
        if (row.crew) row.crew = JSON.parse(row.crew);
        if (row.production_countries) row.production_countries = JSON.parse(row.production_countries);
      } catch (e) {}
      return row;
    }
  } else if (mockMetadata[mediaId]) {
    return mockMetadata[mediaId];
  }

  let metadata: any = {
    media_id: mediaId,
    media_type: type,
    plot: `Discover the story behind ${titleHint}. A cinematic experience that pushes boundaries and explores new horizons in storytelling.`,
    cast: "Various Artists",
    crew: [],
    director: "Unknown",
    rating: 7.0,
    year: 2024,
    genres: "Drama",
    runtime: "N/A",
    tagline: "Uncover the truth.",
    status: "Released",
    production_companies: [],
    recommendations: [],
    file_path: filePath || null,
    tmdb_id: null,
    backdrop: `https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2000&auto=format&fit=crop`,
    poster: `https://images.unsplash.com/photo-1542204111-97b779407ec7?q=80&w=400&h=600&auto=format&fit=crop`
  };

  if (TMDB_API_KEY) {
    try {
      const searchType = type === 'movie' ? 'movie' : 'tv';
      const searchRes = await fetch(`https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(titleHint)}`);
      const searchData: any = await searchRes.json();

      if (searchData.results && searchData.results.length > 0) {
        const bestMatch = searchData.results[0];
        const detailsRes = await fetch(`https://api.themoviedb.org/3/${searchType}/${bestMatch.id}?api_key=${TMDB_API_KEY}&append_to_response=credits,recommendations,images`);
        const details: any = await detailsRes.json();

        metadata = {
          ...metadata,
          tmdb_id: bestMatch.id,
          plot: details.overview || metadata.plot,
          tagline: details.tagline || metadata.tagline,
          status: details.status || metadata.status,
          cast: details.credits?.cast?.slice(0, 10).map((c: any) => c.name).join(", ") || metadata.cast,
          crew: details.credits?.crew?.filter((c: any) => ['Director', 'Producer', 'Writer', 'Director of Photography'].includes(c.job)).slice(0, 10).map((c: any) => ({ name: c.name, job: c.job })) || [],
          director: details.credits?.crew?.find((c: any) => c.job === 'Director')?.name || metadata.director,
          rating: details.vote_average || metadata.rating,
          year: parseInt((details.release_date || details.first_air_date || "2024").substring(0, 4)),
          genres: details.genres?.map((g: any) => g.name).join(", ") || metadata.genres,
          runtime: details.runtime ? `${details.runtime}m` : (details.episode_run_time ? `${details.episode_run_time[0]}m` : metadata.runtime),
          production_companies: details.production_companies?.map((pc: any) => pc.name) || [],
          production_countries: details.production_countries?.map((pc: any) => pc.name) || [],
          recommendations: details.recommendations?.results?.slice(0, 10).map((r: any) => ({ id: r.id, title: r.title || r.name, poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null, type: searchType })) || [],
          backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : metadata.backdrop,
          poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : metadata.poster
        };
      }
    } catch (e) {
      console.warn("TMDB Fetch Failed:", e);
    }
  }

  if (pool) {
    const query = `
      INSERT INTO metadata 
      (media_id, media_type, plot, cast, crew, director, rating, year, genres, runtime, backdrop, poster, tagline, status, production_companies, recommendations, production_countries, file_path, tmdb_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
      ON DUPLICATE KEY UPDATE 
      plot=VALUES(plot), backdrop=VALUES(backdrop), poster=VALUES(poster), tagline=VALUES(tagline), 
      status=VALUES(status), production_companies=VALUES(production_companies), recommendations=VALUES(recommendations),
      cast=VALUES(cast), crew=VALUES(crew), director=VALUES(director), rating=VALUES(rating), year=VALUES(year), 
      genres=VALUES(genres), runtime=VALUES(runtime), production_countries=VALUES(production_countries), 
      file_path=VALUES(file_path), tmdb_id=VALUES(tmdb_id)
    `;
    const params = [
      metadata.media_id, metadata.media_type, metadata.plot, metadata.cast, JSON.stringify(metadata.crew), 
      metadata.director, metadata.rating, metadata.year, metadata.genres, metadata.runtime, 
      metadata.backdrop, metadata.poster, metadata.tagline, metadata.status, 
      JSON.stringify(metadata.production_companies), JSON.stringify(metadata.recommendations),
      JSON.stringify(metadata.production_countries || []), metadata.file_path, metadata.tmdb_id
    ];
    await pool.query(query, params).catch(err => console.error("Metadata save failed:", err));
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

// Trending & Categories
app.get("/api/trending", authenticateToken, async (req, res) => {
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  if (!TMDB_API_KEY) return res.json([]);
  try {
    const response = await fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${TMDB_API_KEY}`);
    const data: any = await response.json();
    const trending = data.results.map((r: any) => ({
      id: r.id.toString(),
      title: r.title || r.name,
      poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
      backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/original${r.backdrop_path}` : null,
      media_type: r.media_type,
      rating: r.vote_average,
      year: parseInt((r.release_date || r.first_air_date || "2024").substring(0, 4)),
      is_external: true
    }));
    res.json(trending);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch trending" });
  }
});

async function scanMoviesRecursive(dir: string, baseDir: string = ""): Promise<any[]> {
  const result: any[] = [];
  if (!fs.existsSync(dir)) return result;
  
  const entries = fs.readdirSync(dir).filter(f => !f.startsWith("."));
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const relPath = baseDir ? path.join(baseDir, entry) : entry;
    
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const subResults = await scanMoviesRecursive(fullPath, relPath);
        result.push(...subResults);
      } else if (stat.isFile() && VIDEO_EXTENSIONS.includes(path.extname(entry).toLowerCase())) {
        // If it's your structure: Movies/Title (Year)/File.mp4
        // baseDir will be "Title (Year)"
        const title = baseDir ? path.basename(baseDir) : entry.replace(/\.[^/.]+$/, "").replace(/[._-]/g, " ");
        // Stable ID based on relative path
        const id = Buffer.from(relPath).toString('hex').slice(0, 16);
        result.push({ id, title, file: relPath });
      }
    } catch (e) {
      console.warn(`Error scanning path: ${fullPath}`, e);
    }
  }
  return result;
}

// Media Routes (Protected)
app.get("/api/media/categories", authenticateToken, async (req, res) => {
  try {
    if (!pool) return res.json({});
    
    const [movies]: any = await pool.query("SELECT * FROM metadata WHERE media_type = 'movie' ORDER BY rating DESC");
    const [shows]: any = await pool.query("SELECT * FROM metadata WHERE media_type = 'tv' ORDER BY rating DESC");

    const categories: Record<string, any[]> = {
      "Highly Rated (8.0+)": [...movies, ...shows].filter(m => m.rating >= 8.0).sort((a, b) => b.rating - a.rating).slice(0, 18),
      "Action & Adventure": [...movies, ...shows].filter(m => m.genres?.includes("Action") || m.genres?.includes("Adventure")).slice(0, 18),
      "Sci-Fi & Fantasy": [...movies, ...shows].filter(m => m.genres?.includes("Science Fiction") || m.genres?.includes("Fantasy") || m.genres?.includes("Sci-Fi")).slice(0, 18),
      "Horror & Thriller": [...movies, ...shows].filter(m => m.genres?.includes("Horror") || m.genres?.includes("Thriller") || m.genres?.includes("Mystery")).slice(0, 18),
      "Animation": [...movies, ...shows].filter(m => m.genres?.includes("Animation") || m.genres?.includes("Family")).slice(0, 18),
      "Comedy": [...movies, ...shows].filter(m => m.genres?.includes("Comedy")).slice(0, 18),
      "Drama": [...movies, ...shows].filter(m => m.genres?.includes("Drama")).slice(0, 18),
      "International Hits": [...movies, ...shows].filter(m => {
        const countries = m.production_countries || [];
        return countries.some((c: string) => !c.includes("United States"));
      }).slice(0, 18),
      "Modern Era (2020+)": [...movies, ...shows].filter(m => m.year >= 2020).sort((a, b) => b.year - a.year).slice(0, 18),
      "Classics of the 90s": [...movies, ...shows].filter(m => m.year >= 1990 && m.year < 2000).slice(0, 18),
      "Epic Lengths": movies.filter(m => {
        const mins = parseInt(m.runtime || "0");
        return mins > 140;
      }).slice(0, 18),
      "Recently Added": [...movies, ...shows].sort((a, b) => b.id - a.id).slice(0, 18),
    };

    // Ensure categorical items have the necessary ID/file fields correctly mapped
    Object.keys(categories).forEach(key => {
      categories[key] = categories[key].map(m => ({
        ...m,
        id: m.media_id,
        // For shows, id stays same. For movies, we might need the actual file if it's missing
        // but it should be in the DB already.
      }));
    });

    res.json(categories);
  } catch (e) {
    res.status(500).json({ message: "Failed to load categories" });
  }
});
app.get("/api/movies", authenticateToken, async (req, res) => {
  try {
    const moviesList = await scanMoviesRecursive(MOVIES_DIR);
    const movies = await Promise.all(moviesList.map(async m => {
      const meta = await getEnhancedMetadata(m.id, "movie", m.title, m.file);
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
          // Robust season detection for structure like /Show/Season 1/Episode.mkv
          let season = "1";
          const seasonMatch = relPath.match(/(?:Season|S)\s*(\d+)/i);
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

app.get("/api/subtitles/online", authenticateToken, async (req: any, res) => {
  const { imdbid, tmdbid, type, filename, season, episode } = req.query;
  try {
    const searchParams: any = {
      sublanguageid: 'eng', // Default to english for now
      limit: '5',
    };

    if (imdbid) searchParams.imdbid = imdbid;
    if (tmdbid) searchParams.tmdbid = tmdbid;
    if (type === 'tv') {
      searchParams.season = season;
      searchParams.episode = episode;
    }
    if (filename) searchParams.filename = filename;

    const results = await OS.search(searchParams);
    
    // Format results to be easily consumable by frontend
    const formatted = Object.entries(results).map(([lang, data]: [string, any]) => ({
      lang,
      ...data
    })).filter(d => d.url); // Only those with download urls

    res.json(formatted);
  } catch (e) {
    console.error("Subtitle search failed:", e);
    res.status(500).json({ error: "Failed to search subtitles" });
  }
});

// Proxy to download and convert srt to vtt on the fly
app.get("/api/subtitles/download", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("No URL provided");

  try {
    const response = await fetch(url as string);
    if (!response.ok) throw new Error("Failed to fetch subtitle");
    
    const srtData = await response.arrayBuffer();
    const buffer = Buffer.from(srtData);

    res.setHeader("Content-Type", "text/vtt");
    
    // Create a stream and pipe it through srt2vtt
    const { Readable } = await import("stream");
    const readable = Readable.from(buffer);
    
    readable
      .pipe(srt2vtt())
      .pipe(res);

  } catch (e) {
    console.error("Subtitle download/convert failed:", e);
    res.status(500).send("Error processing subtitle");
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

app.get("/api/stream/movie/:id", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    let filePath = "";
    
    // Check if ID is a hex path
    if (pool) {
      const [rows]: any = await pool.query("SELECT file_path FROM metadata WHERE media_id = ?", [id]);
      if (rows.length > 0) filePath = rows[0].file_path;
    }

    if (!filePath) {
      // Fallback: assume ID is the path (old behavior)
      filePath = id;
    }

    const fullPath = path.join(MOVIES_DIR, filePath);
    if (fs.existsSync(fullPath)) {
      res.sendFile(fullPath);
    } else {
      res.status(404).json({ message: "File not found" });
    }
  } catch (e) {
    res.status(500).json({ message: "Streaming error" });
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
