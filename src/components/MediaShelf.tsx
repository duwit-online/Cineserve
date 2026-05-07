import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Play, Info, Plus, Check } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaShelfProps {
  title: string;
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  onAddToWatchlist: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  variant?: 'poster' | 'backdrop';
}

export const MediaShelf: React.FC<MediaShelfProps> = ({ 
  title, 
  items, 
  onSelect, 
  onAddToWatchlist,
  isInWatchlist,
  variant = 'backdrop'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const onScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="relative mb-8 group/shelf">
      <h2 className="px-6 md:px-12 text-lg md:text-xl font-medium text-gray-300 mb-2">{title}</h2>
      
      <div className="relative px-0">
        {/* Navigation Arrows */}
        <AnimatePresence>
          {showLeftArrow && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => scroll('left')}
              className="absolute left-0 top-6 bottom-0 w-12 bg-black/60 z-20 flex items-center justify-center backdrop-blur-sm opacity-0 group-hover/shelf:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-8 h-8" />
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRightArrow && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => scroll('right')}
              className="absolute right-0 top-6 bottom-0 w-12 bg-black/60 z-20 flex items-center justify-center backdrop-blur-sm opacity-0 group-hover/shelf:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-8 h-8" />
            </motion.button>
          )}
        </AnimatePresence>

        <div 
          ref={scrollRef}
          onScroll={onScroll}
          className="shelf-container"
        >
          {items.map((item, idx) => (
            <motion.div
              key={item.id + idx}
              whileHover={{ scale: 1.15 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`shelf-card group cursor-pointer relative shrink-0 ${variant === 'poster' ? 'w-[160px] md:w-[220px] aspect-[2/3]' : 'w-[240px] md:w-[320px] aspect-video'}`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSelect(item);
              }}
            >
              <img 
                src={(variant === 'poster' ? item.metadata?.poster : item.metadata?.backdrop) || item.poster || `https://images.unsplash.com/photo-1542204111-97b779407ec7?q=80&w=400&h=600&auto=format&fit=crop`}
                alt={item.title}
                className="w-full h-full object-cover rounded-lg"
                loading="lazy"
              />
              
              {/* Overlay on hover/focus */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <p className="text-sm font-bold truncate mb-2">{item.title}</p>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onSelect(item); }}
                    className="p-1.5 bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onAddToWatchlist(item); }}
                    className="p-1.5 bg-gray-800/80 rounded-full hover:bg-gray-700 transition-colors"
                  >
                    {isInWatchlist(item.id) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  </button>
                </div>
                <div className="mt-2 flex gap-2 text-[10px] text-gray-300">
                  <span>{item.metadata?.year}</span>
                  <span className="border border-white/20 px-1 rounded">{item.metadata?.rating || '8.0'}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
