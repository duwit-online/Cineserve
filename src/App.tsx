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
  Bookmark
} from "lucide-react";

import { MediaShelf } from "./components/MediaShelf";
import { Hero } from "./components/Hero";
import { FilterBar } from "./components/FilterBar";
import { MediaItem, MediaMetadata, PlaybackProgress, View } from "./types";

export default function App() {
  const [user, setUser] = useState<{username: string, theme?: string} | null>(() => {
    const saved = localStorage.getItem("cinode_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem("cinode_token"));
  
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [shows, setShows] = useState<MediaItem[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [progressData, setProgressData] = useState<PlaybackProgress[]>([]);
  
  // Advanced Filters
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState("");
  const [rating, setRating] = useState("");

  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [view, setView] = useState<View | 'player' | 'tv-details' | 'auth'>("home");
  const [activeTab, setActiveTab] = useState<"all" | "movies" | "tv">("all");
  
  const [tvDetails, setTvDetails] = useState<any | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authError, setAuthError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const playerRef = useRef<HTMLVideoElement>(null);
  const lastProgressRef = useRef<number>(0);

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
  };

  const saveProgress = async (pos: number, dur: number) => {
    if (!token || !selectedMedia) return;
    const type = selectedMedia.file ? 'movie' : 'tv';
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
                  onPlay={handleMediaClick} 
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
                  <>
                    <MediaShelf 
                      title="Movies Collection" 
                      items={movies} 
                      onSelect={handleMediaClick}
                      onAddToWatchlist={toggleWatchlist}
                      isInWatchlist={(id) => watchlist.some(m => m.media_id === id)}
                    />
                    <MediaShelf 
                      title="TV Series" 
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
                  </>
                )}
              </div>
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
                   {Object.entries(tvDetails.seasons).map(([season, episodes]) => (
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
               <motion.div initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black">
                 <div className="absolute top-0 inset-x-0 p-8 flex items-center justify-between z-[210] bg-gradient-to-b from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                    <button onClick={() => setView(tvDetails ? "tv-details" : "home")} className="flex items-center gap-4 group">
                       <div className="p-3 glass rounded-full group-hover:bg-primary group-hover:text-black transition-all"><ChevronLeft /></div>
                       <div className="text-left">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{selectedMedia.title}</p>
                          <p className="text-xs font-black uppercase tracking-tight">{currentEpisode || 'Full Movie'}</p>
                       </div>
                    </button>
                 </div>
                 <video 
                   ref={playerRef}
                   autoPlay controls className="w-full h-full"
                   onTimeUpdate={onTimeUpdate}
                   onPlay={onPlayerPlay}
                   src={`${currentEpisode ? `/api/stream/tv/${selectedMedia.id}/${currentEpisode}` : `/api/stream/movie/${selectedMedia.id}`}?token=${token}`}
                 >
                    <track 
                      label="English" kind="subtitles" srcLang="en" default
                      src={`${currentEpisode ? `/api/subtitles/tv/${selectedMedia.id}/${currentEpisode}` : `/api/subtitles/movie/${selectedMedia.id}`}?token=${token}`}
                    />
                 </video>
               </motion.div>
             )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
