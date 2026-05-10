import { useEffect, useRef, useState } from 'react';
import {
  searchRoute,
  addRoute,
  type RouteSearchResult,
  type RouteStop,
} from '@/api/gohomeApi';
import './RouteSearchSheet.css';

import busIcon from '../../assets/icons/bus.fill.svg';
import searchIcon from '../../assets/icons/magnifyingglass.svg';
import xmarkIcon from '../../assets/icons/xmark.svg';
import mappinIcon from '../../assets/icons/mappin.and.ellipse.svg';
import flagIcon from '../../assets/icons/flag.pattern.checkered.svg';

type Category = 'minsk' | 'home';

interface Props {
  tgId: number;
  defaultCategory: Category;
  onClose: () => void;
  onAdded: () => void;
}

export function RouteSearchSheet({ tgId, defaultCategory, onClose, onAdded }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RouteSearchResult | null>(null);
  const [direction, setDirection] = useState(0);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [saving, setSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setResult(null);
    setFromId(null);
    setToId(null);
    try {
      const r = await searchRoute(q);
      setResult(r);
      setDirection(r.directions[0]?.direction ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не найдено');
    } finally {
      setLoading(false);
    }
  };

  const onStopTap = (id: string) => {
    if (!fromId) {
      setFromId(id);
      return;
    }
    if (fromId === id) {
      setFromId(null);
      return;
    }
    if (!toId) {
      setToId(id);
      return;
    }
    if (toId === id) {
      setToId(null);
      return;
    }
    // both set already → reset and start over with this as from
    setFromId(id);
    setToId(null);
  };

  const onSave = async () => {
    if (!result || !fromId || !toId) return;
    setSaving(true);
    setError('');
    try {
      await addRoute({
        tg_id: tgId,
        category,
        route_number: result.route_number,
        direction,
        stop_from_id: fromId,
        stop_to_id: toId,
      });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const dirData = result?.directions.find((d) => d.direction === direction);
  const stops = dirData?.stops ?? [];

  // Validate from/to ordering: "from" must come before "to" along the route.
  const fromIdx = stops.findIndex((s) => s.id === fromId);
  const toIdx = stops.findIndex((s) => s.id === toId);
  const orderingInvalid = fromId && toId && fromIdx >= 0 && toIdx >= 0 && toIdx <= fromIdx;
  const canSave = !!(result && fromId && toId && !orderingInvalid && !saving);

  return (
    <div className="rs-overlay" onClick={onClose}>
      <div className="rs-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="rs-handle" />

        {/* Header */}
        <div className="rs-header">
          <div className="rs-header-title">Найти автобус</div>
          <button className="rs-close" onClick={onClose} aria-label="Закрыть">
            <img src={xmarkIcon} alt="" className="rs-close-icon" />
          </button>
        </div>

        {/* Search input */}
        <div className="rs-search-row">
          <div className="rs-search-field">
            <img src={searchIcon} alt="" className="rs-search-input-icon" />
            <input
              ref={inputRef}
              className="rs-search-input"
              placeholder="Номер маршрута"
              value={query}
              inputMode="text"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
            {query && (
              <button
                className="rs-clear"
                onClick={() => setQuery('')}
                aria-label="Очистить"
              >
                <img src={xmarkIcon} alt="" className="rs-clear-icon" />
              </button>
            )}
          </div>
          <button
            className="rs-search-btn"
            onClick={runSearch}
            disabled={loading || !query.trim()}
          >
            {loading ? '...' : 'Найти'}
          </button>
        </div>

        {/* Body */}
        <div className="rs-body">
          {error && <div className="rs-error">{error}</div>}

          {!result && !loading && !error && (
            <div className="rs-hint">
              <img src={busIcon} alt="" className="rs-hint-icon" />
              <div className="rs-hint-text">Введите номер маршрута</div>
              <div className="rs-hint-sub">Например, 311 или 100</div>
            </div>
          )}

          {result && (
            <>
              <div className="rs-route-header">
                <div className="rs-route-num">№ {result.route_number}</div>
                <div className="rs-route-name">
                  {direction === 0 ? result.name_a : result.name_b}
                </div>
              </div>

              {/* Direction toggle */}
              <div className="rs-direction-pill">
                {result.directions.map((d) => (
                  <button
                    key={d.direction}
                    className={`rs-direction-tab ${
                      direction === d.direction ? 'active' : ''
                    }`}
                    onClick={() => {
                      setDirection(d.direction);
                      setFromId(null);
                      setToId(null);
                    }}
                  >
                    {d.end_stop || (d.direction === 0 ? 'A → B' : 'B → A')}
                  </button>
                ))}
              </div>

              {/* Category */}
              <div className="rs-section-label">Категория</div>
              <div className="rs-category-pill">
                <button
                  className={`rs-category-tab ${category === 'minsk' ? 'active' : ''}`}
                  onClick={() => setCategory('minsk')}
                >
                  В Минск
                </button>
                <button
                  className={`rs-category-tab ${category === 'home' ? 'active' : ''}`}
                  onClick={() => setCategory('home')}
                >
                  Домой
                </button>
              </div>

              {/* Stops */}
              <div className="rs-section-label">
                {fromId
                  ? toId
                    ? 'Готово'
                    : 'Выберите конечную остановку'
                  : 'Выберите начальную остановку'}
              </div>
              <div className="rs-stops">
                {stops.map((s) => (
                  <StopRow
                    key={s.id}
                    stop={s}
                    isFrom={s.id === fromId}
                    isTo={s.id === toId}
                    onTap={onStopTap}
                  />
                ))}
                {!stops.length && (
                  <div className="rs-empty">Нет остановок</div>
                )}
              </div>

              {orderingInvalid && (
                <div className="rs-warning">
                  Конечная остановка должна быть после начальной
                </div>
              )}
            </>
          )}
        </div>

        {/* Save button */}
        {result && (
          <div className="rs-footer">
            <button
              className="rs-save-btn"
              disabled={!canSave}
              onClick={onSave}
            >
              {saving ? 'Сохраняю...' : 'Добавить маршрут'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StopRow({
  stop,
  isFrom,
  isTo,
  onTap,
}: {
  stop: RouteStop;
  isFrom: boolean;
  isTo: boolean;
  onTap: (id: string) => void;
}) {
  return (
    <button
      className={`rs-stop ${isFrom ? 'from' : ''} ${isTo ? 'to' : ''}`}
      onClick={() => onTap(stop.id)}
    >
      <span className="rs-stop-marker">
        {isFrom ? (
          <img src={mappinIcon} alt="" className="rs-stop-marker-icon" />
        ) : isTo ? (
          <img src={flagIcon} alt="" className="rs-stop-marker-icon" />
        ) : (
          <span className="rs-stop-dot" />
        )}
      </span>
      <span className="rs-stop-name">{stop.name}</span>
    </button>
  );
}
