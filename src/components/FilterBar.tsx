import React from 'react';
import { Search, Filter } from 'lucide-react';

interface FilterBarProps {
  search: string;
  setSearch: (s: string) => void;
  genre: string;
  setGenre: (g: string) => void;
  year: string;
  setYear: (y: string) => void;
  rating: string;
  setRating: (r: string) => void;
}

const GENRES = ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Thriller", "Documentary"];
const YEARS = ["2024", "2023", "2022", "2021", "2020", "2010s", "2000s"];
const RATINGS = ["9+", "8+", "7+", "6+"];

export const FilterBar: React.FC<FilterBarProps> = ({
  search, setSearch,
  genre, setGenre,
  year, setYear,
  rating, setRating
}) => {
  return (
    <div className="px-6 md:px-12 py-4 flex flex-col md:flex-row gap-4 items-center">
      <div className="relative w-full md:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, cast..."
          className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 focus:ring-2 focus:ring-primary outline-none transition-all"
        />
      </div>

      <div className="flex gap-2 w-full overflow-x-auto pb-2 md:pb-0 no-scrollbar">
        <select 
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer"
        >
          <option value="">All Genres</option>
          {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select 
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer"
        >
          <option value="">All Years</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select 
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer"
        >
          <option value="">All Ratings</option>
          {RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
    </div>
  );
};
