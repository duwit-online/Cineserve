import React from 'react';
import { Play, Info, Plus, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { MediaItem } from '../types';

interface HeroProps {
  item: MediaItem;
  onPlay: (item: MediaItem) => void;
  onInfo: (item: MediaItem) => void;
  onAddToWatchlist: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
}

export const Hero: React.FC<HeroProps> = ({ item, onPlay, onInfo, onAddToWatchlist, isInWatchlist }) => {
  return (
    <div className="relative h-[70vh] md:h-[85vh] w-full overflow-hidden">
      {/* Background Image */}
      <motion.div 
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <img 
          src={item.metadata?.backdrop || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2000&auto=format&fit=crop"} 
          alt={item.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 hero-gradient" />
      </motion.div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end px-6 md:px-12 pb-24 md:pb-32 max-w-4xl z-10">
        <motion.div
           initial={{ y: 50, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ delay: 0.5, duration: 0.8 }}
        >
          <span className="inline-block px-2 py-0.5 mb-4 text-[10px] font-bold uppercase tracking-widest bg-primary rounded border border-white/10">
            Featured
          </span>
          <h1 className="text-4xl md:text-7xl font-black mb-4 tracking-tighter uppercase leading-none">
            {item.title}
          </h1>
          <div className="flex items-center gap-4 mb-6 text-sm md:text-base font-medium text-gray-300">
            <span className="text-green-500">98% Match</span>
            <span>{item.metadata?.year}</span>
            <span className="border border-white/20 px-2 rounded-sm text-xs">{item.metadata?.rating}</span>
            <span>{item.metadata?.runtime}</span>
          </div>
          <p className="text-gray-200 text-sm md:text-lg mb-8 line-clamp-3 md:line-clamp-none max-w-2xl leading-relaxed">
            {item.metadata?.plot}
          </p>

          <div className="flex flex-wrap gap-4">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => onPlay(item)}
              className="flex items-center gap-3 px-8 py-3 bg-white text-black rounded-lg font-bold hover:bg-gray-200 transition-colors"
            >
              <Play className="w-5 h-5 fill-current" />
              Play Now
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => onAddToWatchlist(item)}
              className="flex items-center gap-3 px-8 py-3 glass rounded-lg font-bold hover:bg-white/10 transition-colors"
            >
              {isInWatchlist(item.id) ? (
                <>
                  <Check className="w-5 h-5" /> In Watchlist
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" /> Watchlist
                </>
              )}
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => onInfo(item)}
              className="flex items-center justify-center p-3 glass rounded-lg hover:bg-white/10 transition-colors"
            >
              <Info className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Atmospheric Glow */}
      <div className="atmosphere-glow" />
    </div>
  );
};
