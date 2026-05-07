import React, { useState, useEffect, useMemo, FormEvent, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  Info, 
  ChevronLeft, 
  Tv, 
  Film, 
  Search, 
  Bell, 
  User,
  Plus,
  ThumbsUp,
  LogOut,
  Lock,
  ArrowRight,
  Settings,
  History as HistoryIcon,
  Bookmark,
  Pause,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  FastForward,
  Subtitles,
  Zap,
  RotateCcw,
  SkipForward
} from "lucide-react";

import { MediaShelf } from "./components/MediaShelf";
import { Hero } from "./components/Hero";
import { FilterBar } from "./components/FilterBar";
import { MediaDetailModal } from "./components/MediaDetailModal";
import { MediaItem, MediaMetadata, PlaybackProgress, View } from "./types";

export default function App() {
  const [user, setUser] = useState<{username: string, theme?: string} | null>(() => {
    try {
      const saved = localStorage.getItem("cinode_user");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to parse cinode_user from localStorage", e);
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem("cinode_token"));
  
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authError, setAuthError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [shows, setShows] = useState<MediaItem[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [progressData, setProgressData] = useState<PlaybackProgress[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [categories, setCategories] = useState<Record<string, any>>({});
  
  // Advanced Filters
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState("");
  const [rating, setRating] = useState("");

  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [view, setView] = useState<View | 'player' | 'tv-details' | 'auth'>("home");
  const [activeTab, setActiveTab] = useState<"all" | "movies" | "tv">("all");
  
  const [tvDetails, setTvDetails] = useState<any | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Enhanced Player States
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [onlineSubtitles, setOnlineSubtitles] = useState<any[]>([]);
  const [selectedOnlineSub, setSelectedOnlineSub] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchingSubs, setIsSearchingSubs] = useState(false);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressRef = useRef<number>(0);
  const playerRef = useRef<HTMLVideoElement>(null);

  // Initial Fetches
  useEffect(() => {
    if (!token) {
      setView("auth");
      return;
    }

    const headers = { 'Authorization': `Bearer ${token}` };
    
    fetch("/api/movies", { headers }).then(res => res.json()).then(data => {
      if (Array.isArray(data)) setMovies(data);
    });
    fetch("/api/tv", { headers }).then(res => res.json()).then(data => {
      if (Array.isArray(data)) setShows(data);
    });
    fetch("/api/watchlist", { headers }).then(res => res.json()).then(data => {
      if (Array.isArray(data)) setWatchlist(data);
    });
    fetch("/api/history", { headers }).then(res => res.json()).then(data => {
      if (Array.isArray(data)) setHistory(data);
    });
    fetch("/api/progress", { headers }).then(res => res.json()).then(data => {
      if (Array.isArray(data)) setProgressData(data);
    });
    fetch("/api/trending", { headers }).then(res => res.json()).then(data => {
      if (Array.isArray(data)) setTrending(data);
    });
    fetch("/api/media/categories", { headers }).then(res => res.json()).then(data => {
      if (data && typeof data === 'object' && !Array.isArray(data)) setCategories(data);
    });

    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [token]);

  // --- Filtering Logic ---
  const filteredMedia = useMemo(() => {
    const list = activeTab === 'all' ? [...movies, ...shows] : activeTab === 'movies' ? movies : shows;
    return list.filter(m => {
      const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase()) || m.metadata?.cast?.toLowerCase().includes(search.toLowerCase());
      const matchGenre = !genre || m.metadata?.genres?.includes(genre);
      const matchYear = !year || (
        year === "2010s" ? (m.metadata?.year && m.metadata.year >= 2010 && m.metadata.year < 2020) :
        year === "2000s" ? (m.metadata?.year && m.metadata.year >= 2000 && m.metadata.year < 2010) :
        m.metadata?.year?.toString() === year
      );
      const matchRating = !rating || (m.metadata?.rating && m.metadata.rating >= parseFloat(rating));
      return matchSearch && matchGenre && matchYear && matchRating;
    });
  }, [movies, shows, activeTab, search, genre, year, rating]);

  // --- Actions ---
  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const endpoint = authMode === "signin" ? "/api/auth/signin" : "/api/auth/signup";
    try {
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        if (authMode === "signin") {
          localStorage.setItem("cinode_token", data.token);
          localStorage.setItem("cinode_user", JSON.stringify(data.user));
          setToken(data.token);
          setUser(data.user);
          setView("home");
        } else {
          setAuthMode("signin");
          setAuthError("Sign up successful! Sign in now.");
        }
      } else setAuthError(data.message);
    } catch (e) { setAuthError("Server unreachable"); }
  };

  const logout = () => {
    localStorage.removeItem("cinode_token");
    localStorage.removeItem("cinode_user");
    setToken(null);
    setUser(null);
    setView("auth");
  };

  const toggleWatchlist = async (item: MediaItem) => {
    if (!token) return;
    const type = item.file ? 'movie' : 'tv';
    const res = await fetch("/api/watchlist/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ media_id: item.id, media_type: type, title: item.title, poster: item.poster })
    });
    if (res.ok) {
      const { action } = await res.json();
      if (action === "added") setWatchlist(p => [{ media_id: item.id, media_type: type, title: item.title, poster: item.poster }, ...p]);
      else setWatchlist(p => p.filter(m => !(m.media_id === item.id && m.media_type === type)));
    }
  };

  const handleMediaClick = async (media: MediaItem) => {
    // If it's a TV show ID from a category shelf, we might need to fetch its full object
    // but the Modal handles metadata fine if passed.
    setSelectedMedia(media);
    setIsDetailOpen(true);
  };

  const handleStartPlayback = async (media: MediaItem) => {
    setIsDetailOpen(false);
    setSelectedMedia(media);
    setCurrentEpisode(null);
    const type = media.file ? "movie" : "tv";
    if (type === "tv") {
      const res = await fetch(`/api/tv/${media.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const details = await res.json();
      setTvDetails(details);
      setView("tv-details");
    } else {
      setView("player");
    }
  };

  const handlePlayEpisode = (ep: string) => {
    setCurrentEpisode(ep);
    setView("player");
    setIsPlaying(true);
    setCurrentTime(0);
    setSelectedOnlineSub(null);
    setOnlineSubtitles([]);
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pause();
    else playerRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const skipForward = (seconds: number) => {
    if (!playerRef.current) return;
    playerRef.current.currentTime += seconds;
  };

  const skipBackward = (seconds: number) => {
    if (!playerRef.current) return;
    playerRef.current.currentTime -= seconds;
  };

  const skipIntro = () => {
    if (!playerRef.current) return;
    playerRef.current.currentTime += 85;
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    playerRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (v: number) => {
    if (!playerRef.current) return;
    playerRef.current.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
  };

  const handleSpeedChange = (speed: number) => {
    if (!playerRef.current) return;
    playerRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isSettingsOpen) setShowControls(false);
    }, 3000);
  };

  const searchSubtitlesOnline = async () => {
    if (!selectedMedia) return;
    setIsSearchingSubs(true);
    try {
      const tmdbId = selectedMedia.metadata?.tmdb_id || selectedMedia.id;
      const type = selectedMedia.metadata?.media_type || (selectedMedia.file ? 'movie' : 'tv');
      const q = new URLSearchParams({
        tmdbid: tmdbId.toString(),
        type,
        filename: currentEpisode || ''
      });
      if (type === 'tv' && currentEpisode) {
        const match = currentEpisode.match(/S(\d+)E(\d+)/i);
        if (match) {
          q.append('season', parseInt(match[1]).toString());
          q.append('episode', parseInt(match[2]).toString());
        }
      }
      const res = await fetch(`/api/subtitles/online?${q}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setOnlineSubtitles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Online sub search failed", e);
    } finally {
      setIsSearchingSubs(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const saveProgress = async (pos: number, dur: number) => {
    if (!token || !selectedMedia) return;
    const type = selectedMedia.metadata?.media_type || (selectedMedia.file ? 'movie' : 'tv');
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        media_id: selectedMedia.id,
        media_type: type,
        episode_id: currentEpisode,
        position_seconds: Math.floor(pos),
        duration_seconds: Math.floor(dur)
      })
    });
  };

  const onTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setCurrentTime(video.currentTime);
    setDuration(video.duration);
    if (Math.abs(video.currentTime - lastProgressRef.current) > 10) {
      lastProgressRef.current = video.currentTime;
      saveProgress(video.currentTime, video.duration);
    }
  };

  const onPlayerPlay = () => {
    if (!selectedMedia) return;
    const type = selectedMedia.file ? 'movie' : 'tv';
    const prog = progressData.find(p => p.media_id === selectedMedia.id && p.media_type === type && (type === 'movie' || p.episode_id === currentEpisode));
    if (prog && prog.position_seconds > 0 && playerRef.current && playerRef.current.currentTime === 0) {
       playerRef.current.currentTime = prog.position_seconds;
    }
    // Record History on start
    fetch("/api/history/add", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ media_id: selectedMedia.id, media_type: type, title: selectedMedia.title, episode: currentEpisode })
    });
  };

  const continueWatchingItems = useMemo(() => {
    return progressData
      .filter(p => p.position_seconds < p.duration_seconds * 0.95 && p.duration_seconds > 0)
      .sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .map(p => {
        const item = p.media_type === 'movie' ? movies.find(m => m.id === p.media_id) : shows.find(s => s.id === p.media_id);
        return item ? { ...item, progress: p } : null;
      }).filter(Boolean) as any[];
  }, [progressData, movies, shows]);

  const featured = movies[0] || shows[0];

  return (
    <div className="min-h-screen bg-bg text-gray-100 selection:bg-primary">
      {view === "auth" ? (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[200]">
           <div className="atmosphere-glow" />
           <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm glass p-10 rounded-3xl space-y-8">
              <div className="text-center space-y-2">
                 <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(229,9,20,0.4)]">
                    <Film className="text-white w-8 h-8" />
                 </div>
                 <h1 className="text-4xl font-display font-black tracking-tighter">CINODE</h1>
                 <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">Node Architecture v2.0</p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                 {authError && <div className="text-red-400 text-[10px] text-center font-bold bg-red-400/10 py-2 rounded-lg border border-red-400/20">{authError}</div>}
                 <input value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="Username" />
                 <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="Passcode" />
                 <button type="submit" className="w-full bg-primary text-white font-black py-4 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-xl uppercase tracking-widest text-xs">
                    {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
                 </button>
              </form>
              <button 
                onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                className="w-full text-[10px] text-gray-500 hover:text-white transition-colors font-bold uppercase tracking-widest"
              >
                {authMode === 'signin' ? "Need an account? Sign Up" : "Already have an account? Sign In"}
              </button>
           </motion.div>
        </div>
      ) : (
        <>
          <nav className={`fixed top-0 w-full z-50 transition-all duration-500 px-6 md:px-12 py-5 flex items-center justify-between ${isScrolled ? 'bg-bg/90 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'}`}>
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView("home")}>
                <Film className="w-7 h-7 text-primary" />
                <h1 className="text-2xl font-black tracking-tighter">CINODE</h1>
              </div>
              <div className="hidden lg:flex gap-6 text-sm font-bold uppercase tracking-widest text-gray-400">
                <button onClick={() => { setView("home"); setActiveTab("all"); }} className={activeTab === 'all' ? 'text-white' : 'hover:text-white'}>Home</button>
                <button onClick={() => { setView("home"); setActiveTab("movies"); }} className={activeTab === 'movies' ? 'text-white' : 'hover:text-white'}>Movies</button>
                <button onClick={() => { setView("home"); setActiveTab("tv"); }} className={activeTab === 'tv' ? 'text-white' : 'hover:text-white'}>TV Shows</button>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <Bell className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white transition-colors" />
              <div className="group relative">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center cursor-pointer overflow-hidden border border-white/10">
                  <User className="w-5 h-5" />
                </div>
                <div className="absolute top-12 right-0 w-48 glass rounded-xl py-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-y-2 group-hover:translate-y-0">
                  <div className="px-4 py-2 border-b border-white/5 mb-2">
                    <p className="text-xs font-bold text-gray-400 truncate">{user?.username}</p>
                  </div>
                  <button onClick={() => setView("profile")} className="w-full px-4 py-2 text-left text-xs font-bold hover:bg-white/5 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Profile
                  </button>
                  <button onClick={logout} className="w-full px-4 py-2 text-left text-xs font-bold hover:bg-red-500/10 text-red-500 flex items-center gap-2">
                    <LogOut className="w-3.5 h-3.5" /> Disconnect
                  </button>
                </div>
              </div>
            </div>
          </nav>

          {view === "home" && (
            <main className="pb-20">
              {featured && !search && activeTab === "all" && (
                <Hero 
                  item={featured} 
                  onPlay={handleStartPlayback} 
                  onInfo={handleMediaClick}
                  onAddToWatchlist={toggleWatchlist} 
                  isInWatchlist={(id) => watchlist.some(m => m.media_id === id)} 
                />
              )}

              <div className={featured && !search && activeTab === "all" ? "-mt-16 relative z-20" : "pt-28"}>
                <FilterBar 
                  search={search} setSearch={setSearch}
                  genre={genre} setGenre={setGenre}
                  year={year} setYear={setYear}
                  rating={rating} setRating={setRating}
                />

                {continueWatchingItems.length > 0 && !search && (
                   <MediaShelf 
                      title="Continue Watching" 
                      items={continueWatchingItems} 
                      onSelect={handleMediaClick}
                      onAddToWatchlist={toggleWatchlist}
                      isInWatchlist={(id) => watchlist.some(m => m.media_id === id)}
                   />
                )}

                {search || genre || year || rating ? (
                  <div className="px-6 md:px-12 py-10">
                    <h2 className="text-xl font-bold mb-6">Search Results</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
                      {filteredMedia.map(item => (
                        <motion.div 
                          key={item.id} 
                          whileHover={{ scale: 1.05 }}
                          onClick={() => handleMediaClick(item)}
                          className="shelf-card group cursor-pointer relative"
                        >
                          <img src={item.metadata?.backdrop || "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=400&h=600"} className="w-full h-full object-cover rounded-lg" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                            <p className="text-sm font-bold truncate">{item.title}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-12 mb-20">
                    <MediaShelf 
                      title="Cinode Original Movies" 
                      items={movies} 
                      onSelect={handleMediaClick}
                      onAddToWatchlist={toggleWatchlist}
                      isInWatchlist={(id) => watchlist.some(m => m.media_id === id)}
                    />

                    {trending.length > 0 && (
                       <MediaShelf 
                        title="Trending Global (TMDB)" 
                        items={trending} 
                        onSelect={handleMediaClick}
                        onAddToWatchlist={toggleWatchlist}
                        isInWatchlist={(id) => watchlist.some(m => m.media_id === id)}
                        variant="poster"
                      />
                    )}

                    {Object.entries(categories || {}).map(([name, items]: [string, any]) => (
                      items.length > 0 && (
                        <MediaShelf 
                          key={name}
                          title={name} 
                          items={items}
                          onSelect={handleMediaClick}
                          onAddToWatchlist={toggleWatchlist}
                          isInWatchlist={(id) => watchlist.some(m => m.media_id === id)}
                          variant={["Highly Rated (8.0+)", "Modern Era (2020+)", "Classics of the 90s"].includes(name) ? "poster" : "backdrop"}
                        />
                      )
                    ))}

                    <MediaShelf 
                      title="Popular Shows" 
                      items={shows} 
                      onSelect={handleMediaClick}
                      onAddToWatchlist={toggleWatchlist}
                      isInWatchlist={(id) => watchlist.some(m => m.media_id === id)}
                    />

                    {watchlist.length > 0 && (
                       <MediaShelf 
                        title="Your Watchlist" 
                        items={watchlist.map(w => movies.find(m => m.id === w.media_id) || shows.find(s => s.id === w.media_id)).filter(Boolean) as any} 
                        onSelect={handleMediaClick}
                        onAddToWatchlist={toggleWatchlist}
                        isInWatchlist={(id) => watchlist.some(m => m.media_id === id)}
                      />
                    )}
                  </div>
                )}
              </div>
              
              {selectedMedia && (
                <MediaDetailModal 
                  item={selectedMedia}
                  isOpen={isDetailOpen}
                  onClose={() => setIsDetailOpen(false)}
                  onPlay={handleStartPlayback}
                  onToggleWatchlist={toggleWatchlist}
                  isInWatchlist={(id) => watchlist.some(m => m.media_id === id)}
                />
              )}
            </main>
          )}

          {view === "profile" && (
            <main className="pt-32 px-6 md:px-12 max-w-6xl mx-auto pb-20">
              <div className="flex gap-12 flex-col md:flex-row">
                <aside className="w-full md:w-64 space-y-2">
                   <div className="text-gray-500 text-[10px] uppercase font-bold tracking-widest px-4 mb-4">Settings</div>
                   <button className="w-full px-4 py-3 rounded-xl bg-white/5 text-xs font-bold text-left flex items-center gap-3 border border-white/10"><User className="w-4 h-4" /> Account Details</button>
                   <button className="w-full px-4 py-3 rounded-xl hover:bg-white/5 text-xs font-bold text-left flex items-center gap-3 transition-colors"><Bookmark className="w-4 h-4" /> Watchlist</button>
                   <button className="w-full px-4 py-3 rounded-xl hover:bg-white/5 text-xs font-bold text-left flex items-center gap-3 transition-colors"><HistoryIcon className="w-4 h-4" /> History</button>
                   <button onClick={logout} className="w-full px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-500 text-xs font-bold text-left flex items-center gap-3 transition-colors mt-8"><LogOut className="w-4 h-4" /> Terminate Node</button>
                </aside>

                <div className="flex-1 space-y-12">
                   <div className="glass rounded-3xl p-8 space-y-6">
                      <div className="flex items-end gap-6">
                        <div className="w-24 h-24 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/20"><User className="w-12 h-12 text-primary" /></div>
                        <div className="space-y-1">
                          <h2 className="text-3xl font-black tracking-tighter uppercase">{user?.username}</h2>
                          <p className="text-gray-500 text-xs font-mono">UPLINK_ID: {user?.username?.toUpperCase()}_8X</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/5">
                        <div className="text-center">
                          <p className="text-2xl font-black">{watchlist.length}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">In Watchlist</p>
                        </div>
                        <div className="text-center">
                           <p className="text-2xl font-black">{history.length}</p>
                           <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">History</p>
                        </div>
                        <div className="text-center">
                           <p className="text-2xl font-black">{progressData.length}</p>
                           <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Continue</p>
                        </div>
                      </div>
                   </div>

                   <section className="space-y-6">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-2">Recent Protocols</h3>
                      <div className="glass rounded-3xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-white/5 text-gray-500 font-bold uppercase tracking-widest">
                            <tr>
                              <th className="px-6 py-4">Ref</th>
                              <th className="px-6 py-4">Media</th>
                              <th className="px-6 py-4">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 font-medium">
                            {history.slice(0, 5).map((h, i) => (
                              <tr key={i}>
                                <td className="px-6 py-4 opacity-40 font-mono">0{i+1}</td>
                                <td className="px-6 py-4 uppercase tracking-tight">{h.title}</td>
                                <td className="px-6 py-4 text-gray-500">{new Date(h.watched_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                   </section>
                </div>
              </div>
            </main>
          )}

          <AnimatePresence>
             {view === "tv-details" && selectedMedia && tvDetails && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-bg overflow-y-auto pt-24">
                 <div className="relative h-[40vh] mb-12">
                    <img src={selectedMedia.metadata?.backdrop || selectedMedia.poster || ""} className="w-full h-full object-cover opacity-30" />
                    <div className="absolute inset-0 hero-gradient" />
                    <button onClick={() => setView("home")} className="absolute top-8 left-8 p-3 glass rounded-full hover:bg-white/10 transition-all"><ChevronLeft /></button>
                    <div className="absolute bottom-12 left-12 max-w-4xl space-y-4">
                       <h2 className="text-6xl font-black tracking-tighter uppercase">{selectedMedia.title}</h2>
                       <p className="text-gray-400 max-w-2xl text-sm line-clamp-2">{selectedMedia.metadata?.plot}</p>
                    </div>
                 </div>
                 
                 <div className="px-12 space-y-12 pb-20">
                   {Object.entries(tvDetails.seasons || {}).map(([season, episodes]) => (
                     <div key={season} className="space-y-4">
                       <h3 className="text-xs font-bold text-primary uppercase tracking-widest">Season {season}</h3>
                       <div className="grid gap-3">
                         {(episodes as string[]).map((ep, idx) => (
                           <button 
                             key={ep} 
                             onClick={() => handlePlayEpisode(ep)}
                             className="flex items-center justify-between p-5 glass rounded-2xl hover:bg-white/10 transition-all text-left group border-transparent hover:border-white/10"
                           >
                             <div className="flex items-center gap-4">
                               <span className="text-[10px] font-mono text-gray-500">#{idx+1}</span>
                               <span className="text-sm font-bold uppercase tracking-tight">{ep.replace(/\.[^/.]+$/, "")}</span>
                             </div>
                             <Play className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity fill-current text-primary" />
                           </button>
                         ))}
                       </div>
                     </div>
                   ))}
                 </div>
               </motion.div>
             )}

             {view === "player" && selectedMedia && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }} 
                  className="fixed inset-0 z-[200] bg-black group select-none overflow-hidden"
                  onMouseMove={handleMouseMove}
                  style={{ cursor: showControls ? 'default' : 'none' }}
                >
                  <video 
                    ref={playerRef}
                    autoPlay 
                    className="w-full h-full"
                    onTimeUpdate={onTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setView(tvDetails ? "tv-details" : "home")}
                    src={`${currentEpisode ? `/api/stream/tv/${selectedMedia.id}/${encodeURIComponent(currentEpisode)}` : `/api/stream/movie/${encodeURIComponent(selectedMedia.file || selectedMedia.id)}`}?token=${token}`}
                    onClick={togglePlay}
                  >
                     <track 
                       label="Local English" kind="subtitles" srcLang="en" default
                       src={`${currentEpisode ? `/api/subtitles/tv/${selectedMedia.id}/${encodeURIComponent(currentEpisode)}` : `/api/subtitles/movie/${encodeURIComponent(selectedMedia.file || selectedMedia.id)}`}?token=${token}`}
                     />
                     {selectedOnlineSub && (
                        <track 
                          key={selectedOnlineSub}
                          label="Online Subtitle" kind="subtitles" srcLang="en" default
                          src={`/api/subtitles/download?url=${encodeURIComponent(selectedOnlineSub)}`}
                        />
                     )}
                  </video>

                  <AnimatePresence>
                    {showControls && (
                      <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-0 inset-x-0 p-8 flex items-center justify-between z-[220] bg-gradient-to-b from-black/95 to-transparent"
                      >
                        <button onClick={() => setView(tvDetails ? "tv-details" : "home")} className="flex items-center gap-4 group">
                           <div className="p-3 glass rounded-full group-hover:bg-primary group-hover:text-black transition-all"><ChevronLeft /></div>
                           <div className="text-left">
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">{selectedMedia.title}</p>
                              <p className="text-sm font-black uppercase tracking-tight leading-none">{currentEpisode?.replace(/\.[^/.]+$/, "") || 'Full Movie'}</p>
                           </div>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {(showControls || !isPlaying) && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-0 flex items-center justify-center gap-16 z-[215]"
                      >
                         <button onClick={(e) => { e.stopPropagation(); skipBackward(10); }} className="p-4 text-white/50 hover:text-white transition-all"><RotateCcw size={48} /></button>
                         <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-10 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-xl border border-white/20">
                           {isPlaying ? <Pause size={64} fill="currentColor" /> : <Play size={64} fill="currentColor" className="ml-2" />}
                         </button>
                         <button onClick={(e) => { e.stopPropagation(); skipForward(10); }} className="p-4 text-white/50 hover:text-white transition-all"><SkipForward size={48} /></button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {currentTime > 5 && currentTime < 150 && (
                      <motion.div 
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className="absolute bottom-44 right-12 z-[250]"
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); skipIntro(); }}
                          className="flex items-center gap-3 px-8 py-4 glass rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white/20 border border-white/10 transition-all active:scale-95 shadow-2xl"
                        >
                          <Zap size={14} className="text-primary fill-primary" />
                          Skip Intro
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {showControls && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-0 inset-x-0 p-8 pt-32 space-y-6 z-[220] bg-gradient-to-t from-black/95 to-transparent"
                      >
                        <div className="space-y-3 group/timeline">
                          <div className="flex justify-between text-[11px] font-mono font-bold text-gray-400 uppercase tracking-widest px-1">
                            <span>{formatTime(currentTime)}</span>
                            <span className="opacity-40">{formatTime(duration)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/10 rounded-full relative group-hover/timeline:h-3 transition-all">
                            <motion.div 
                              className="absolute inset-y-0 left-0 bg-primary rounded-full z-20"
                              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                            />
                            <input 
                              type="range" min={0} max={duration || 100} step="0.1" value={currentTime}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (playerRef.current) playerRef.current.currentTime = val;
                                setCurrentTime(val);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute inset-0 w-full opacity-0 cursor-pointer z-30"
                            />
                            <div 
                              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover/timeline:opacity-100 transition-opacity z-40 pointer-events-none"
                              style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 8px)` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-8">
                            <div className="flex items-center gap-5 group/volume">
                               <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white/50 hover:text-white transition-colors">
                                 {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
                               </button>
                               <div className="w-0 group-hover/volume:w-32 overflow-hidden transition-all duration-500 ease-out flex items-center pr-2">
                                 <input 
                                   type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume}
                                   onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                   onClick={(e) => e.stopPropagation()}
                                   className="w-full accent-primary h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                                 />
                               </div>
                            </div>

                            <div className="flex items-center bg-white/5 rounded-2xl p-1 border border-white/5">
                               {[0.5, 1, 1.25, 1.5, 2].map(s => (
                                 <button 
                                   key={s}
                                   onClick={(e) => { e.stopPropagation(); handleSpeedChange(s); }}
                                   className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-tighter uppercase transition-all ${playbackSpeed === s ? 'bg-primary text-black' : 'text-gray-500 hover:text-white'}`}
                                 >
                                    {s}x
                                 </button>
                               ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsSettingsOpen(!isSettingsOpen);
                                if (!onlineSubtitles.length) searchSubtitlesOnline();
                              }} 
                              className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all border ${isSettingsOpen ? 'bg-primary border-primary text-black' : 'bg-white/5 border-transparent text-white/70 hover:bg-white/10'}`}
                            >
                               <Subtitles size={22} />
                               <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">Matrix Signals</span>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); playerRef.current?.requestFullscreen(); }} 
                              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white/70 hover:text-white transition-all hover:scale-105"
                            >
                              <Maximize size={22} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {isSettingsOpen && (
                      <motion.div 
                        initial={{ x: 500 }} animate={{ x: 0 }} exit={{ x: 500 }}
                        className="absolute top-0 right-0 bottom-0 w-[450px] bg-black/60 backdrop-blur-3xl border-l border-white/10 z-[300] p-12 flex flex-col gap-12 shadow-[-40px_0_80px_rgba(0,0,0,0.8)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                         <div className="flex items-center justify-between">
                           <div>
                              <h2 className="text-3xl font-black uppercase tracking-tighter">Cipher Stream</h2>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Configuring subtitle decryption</p>
                           </div>
                           <button onClick={() => setIsSettingsOpen(false)} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all active:scale-90"><Plus size={28} className="rotate-45" /></button>
                         </div>

                         <div className="flex-1 overflow-y-auto custom-scrollbar pr-6 space-y-12">
                            <section className="space-y-6">
                              <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-3">
                                <List size={14} />
                                Primary Channel (Local)
                              </p>
                              <button 
                                onClick={() => setSelectedOnlineSub(null)}
                                className={`w-full flex items-center justify-between p-6 rounded-3xl border transition-all ${!selectedOnlineSub ? 'bg-primary border-primary text-black shadow-lg shadow-primary/20' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'}`}
                              >
                                <div className="text-left">
                                  <span className="text-base font-black uppercase tracking-tight">Embedded Data</span>
                                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">Standard Node Stream</p>
                                </div>
                                {!selectedOnlineSub && <Check size={24} className="stroke-[3]" />}
                              </button>
                            </section>

                            <section className="space-y-6">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-3">
                                  <Flame size={14} />
                                  Satellite Uplinks (Online)
                                </p>
                                <button 
                                  onClick={searchSubtitlesOnline} 
                                  disabled={isSearchingSubs}
                                  className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-widest hover:text-white transition-colors disabled:opacity-50"
                                >
                                  <RotateCcw size={14} className={isSearchingSubs ? 'animate-spin' : ''} />
                                  Re-Ping
                                </button>
                              </div>
                              
                              <div className="space-y-4">
                                {isSearchingSubs ? (
                                  <div className="py-24 flex flex-col items-center justify-center gap-8">
                                     <div className="w-16 h-16 border-[4px] border-primary/10 border-t-primary rounded-full animate-spin" />
                                  </div>
                                ) : onlineSubtitles.length > 0 ? (
                                  onlineSubtitles.map((sub, i) => (
                                    <button 
                                      key={i}
                                      onClick={() => setSelectedOnlineSub(sub.url)}
                                      className={`w-full text-left p-6 rounded-3xl border transition-all group ${selectedOnlineSub === sub.url ? 'bg-primary border-primary text-black shadow-lg shadow-primary/20' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'}`}
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                         <p className="text-base font-black uppercase tracking-tight truncate flex-1">{sub.filename || sub.movie_name}</p>
                                         <Check size={18} className={`ml-4 mt-1 shrink-0 ${selectedOnlineSub === sub.url ? 'opacity-100' : 'opacity-0'}`} />
                                      </div>
                                      <div className="flex items-center gap-4">
                                         <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${selectedOnlineSub === sub.url ? 'bg-black/10' : 'bg-primary/20 text-primary'}`}>{sub.lang}</span>
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="py-24 text-center space-y-4 opacity-40">
                                     <Search size={40} className="mx-auto" />
                                  </div>
                                )}
                              </div>
                            </section>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
