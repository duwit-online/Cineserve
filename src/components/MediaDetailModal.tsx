import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Plus, Check, Star, Clock, Calendar, Users } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaDetailModalProps {
  item: MediaItem;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onPlay,
  onToggleWatchlist,
  isInWatchlist
}) => {
  if (!item) return null;
  const meta = item.metadata;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-10">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm shadow-2xl"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-5xl bg-[#141414] rounded-2xl overflow-hidden relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-black/40 hover:bg-black/60 rounded-full z-20 backdrop-blur-md transition-all border border-white/10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Hero Section */}
            <div className="relative h-[400px] md:h-[500px]">
              <img 
                src={meta?.backdrop || item.poster || ""} 
                className="w-full h-full object-cover"
                alt={item.title}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/40 to-transparent" />
              
              <div className="absolute bottom-10 left-6 md:left-12 max-w-2xl space-y-6">
                <div className="space-y-2">
                  <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none">
                    {item.title}
                  </h2>
                  {meta?.tagline && (
                    <p className="text-primary font-bold text-sm uppercase tracking-widest italic opacity-80">
                      {meta.tagline}
                    </p>
                  )}
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => onPlay(item)}
                    className="flex items-center gap-2 px-8 py-4 bg-white text-black rounded-xl font-black uppercase text-sm hover:scale-105 active:scale-95 transition-all shadow-xl"
                  >
                    <Play className="w-5 h-5 fill-current" /> Play Now
                  </button>
                  <button 
                    onClick={() => onToggleWatchlist(item)}
                    className="p-4 glass rounded-xl hover:bg-white/10 transition-all border-white/10"
                  >
                    {isInWatchlist(item.id) ? <Check className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Details Content */}
            <div className="px-6 md:px-12 py-10 grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="md:col-span-2 space-y-8">
                <div className="flex flex-wrap gap-4 text-sm font-bold items-center">
                  <div className="flex items-center gap-1.5 text-green-400">
                    <Star className="w-4 h-4 fill-current" /> {meta?.rating?.toFixed(1) || '8.2'} Rating
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Calendar className="w-4 h-4" /> {meta?.year || '2024'}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Clock className="w-4 h-4" /> {meta?.runtime || '2h 14m'}
                  </div>
                  <span className="px-2 py-0.5 border border-white/20 rounded text-[10px] uppercase">Ultra HD 4K</span>
                </div>

                <div className="space-y-4">
                   <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Synopsys</h3>
                   <p className="text-lg text-gray-300 leading-relaxed font-medium">
                     {meta?.plot}
                   </p>
                </div>

                  {meta?.recommendations && meta.recommendations.length > 0 && (
                   <div className="space-y-6 pt-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Similar Experiences</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {meta.recommendations.map((r: any) => (
                          <div 
                            key={r.id} 
                            onClick={() => onPlay({ id: r.id.toString(), title: r.title, poster: r.poster, metadata: { media_id: r.id.toString(), media_type: r.type, poster: r.poster } } as any)}
                            className="group relative rounded-lg overflow-hidden aspect-video bg-white/5 cursor-pointer"
                          >
                            <img src={r.poster || ""} className="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity" />
                            <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/80 to-transparent">
                               <p className="text-xs font-bold truncate">{r.title}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>
                )}
              </div>

              <div className="space-y-8 border-l border-white/5 pl-0 md:pl-12">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-2">Director</h4>
                    <p className="text-sm font-bold">{meta?.director || 'Unknown'}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-2">Original Crew</h4>
                    <div className="space-y-2">
                       {meta?.crew?.slice(0, 3).map((v: any, i: number) => (
                         <p key={i} className="text-sm font-bold flex justify-between">
                            <span className="text-gray-400 font-medium">{v.job}</span>
                            <span>{v.name}</span>
                         </p>
                       ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-2">Lead Cast</h4>
                    <p className="text-sm text-gray-300 leading-relaxed font-medium">{meta?.cast}</p>
                  </div>

                  <div>
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-2">Genres</h4>
                    <div className="flex flex-wrap gap-2">
                       {meta?.genres?.split(", ").map(g => (
                         <span key={g} className="text-[11px] font-bold px-3 py-1 bg-white/5 rounded-full border border-white/5">{g}</span>
                       ))}
                    </div>
                  </div>

                  {meta?.production_companies && meta.production_companies.length > 0 && (
                     <div>
                        <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-2">Production</h4>
                        <p className="text-sm text-gray-400 font-medium">{meta.production_companies.join(", ")}</p>
                     </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
