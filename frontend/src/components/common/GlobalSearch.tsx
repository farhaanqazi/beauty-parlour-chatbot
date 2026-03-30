import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/apiClient';
import { useDebounce } from '../../hooks/useDebounce';

interface SearchResult {
  id: string;
  type: 'appointment' | 'customer';
  title: string;
  subtitle: string;
  navigateTo: string;
}

const GlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const params: Record<string, string> = { q: debouncedQuery };
      if (user?.role !== 'admin' && user?.salon_id) {
        params.salon_id = user.salon_id;
      }
      const { data } = await apiClient.get('/api/v1/search', { params });
      return data;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 10000,
  });

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSelect = (result: SearchResult) => {
    navigate(result.navigateTo);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative w-full">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/10 border border-neutral-200 dark:border-white/10 transition-all duration-200 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-neutral-800"
        onClick={() => inputRef.current?.focus()}
      >
        <Search className="w-4 h-4 text-neutral-400 flex-shrink-0" strokeWidth={2} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search appointments, customers… (⌘K)"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
        {isLoading && (
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
      </div>

      {open && debouncedQuery.length >= 2 && (
        <>
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-white/10 shadow-xl z-50 max-h-96 overflow-y-auto"
            onMouseDown={(e) => e.preventDefault()}
          >
            {!results || results.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No results found for "{debouncedQuery}"
                </p>
              </div>
            ) : (
              <ul className="py-2">
                {results.map((result) => (
                  <li
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    className="flex items-center gap-3 px-3 py-2 mx-1 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                      {result.type === 'appointment'
                        ? <Calendar className="w-5 h-5 text-blue-600" strokeWidth={2} />
                        : <User className="w-5 h-5 text-emerald-600" strokeWidth={2} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                        {result.title}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        {result.subtitle}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className="fixed inset-0 z-40"
            onClick={() => { setOpen(false); setQuery(''); }}
          />
        </>
      )}
    </div>
  );
};

export default GlobalSearch;
