import { useState, useEffect, useCallback } from 'react';
import { API } from '../api';
import { extractList, showError } from '../utils';

/**
 * Shared hook for paginated list pages (Channel, Token, User, Log, etc.)
 *
 * @param {string} endpoint - Base API endpoint, e.g. '/api/channel/'
 * @param {object} options
 * @param {string} options.searchEndpoint - Search endpoint, e.g. '/api/channel/search'
 * @param {number} options.pageSize - Initial page size (default 20)
 * @param {boolean} options.autoFetch - Auto-fetch on mount (default true)
 * @param {object} options.extraParams - Extra query params
 */
export default function usePaginatedList(endpoint, options = {}) {
  const { searchEndpoint, pageSize: initSize = 20, autoFetch = true, extraParams } = options;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initSize);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const useSearch = search && searchEndpoint;
      const base = useSearch
        ? `${searchEndpoint}?keyword=${encodeURIComponent(search)}`
        : endpoint;
      const sep = base.includes('?') ? '&' : '?';
      const params = new URLSearchParams({ p: String(page + 1), page_size: String(rowsPerPage), ...extraParams });
      const url = `${base}${sep}${params}`;
      const res = await API.get(url);
      if (res.data.success) {
        const { items: list, total: t } = extractList(res.data);
        setItems(list);
        setTotal(t);
      }
    } catch (err) {
      showError(err);
    }
    setLoading(false);
  }, [endpoint, searchEndpoint, page, rowsPerPage, search, extraParams]);

  useEffect(() => {
    // Existing hook contract: auto-fetch when pagination/search inputs change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoFetch) fetchData();
  }, [fetchData, autoFetch]);

  const changeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value));
    setPage(0);
  };

  return {
    items, setItems, loading, page, setPage,
    rowsPerPage, changeRowsPerPage, total,
    search, setSearch, refresh: fetchData,
  };
}
