import { useEffect, useState, useCallback } from 'react';
import { getSchedule, type RouteSchedule, type HourEntry } from '@/api/gohomeApi';
import './GoHomeScreen.css';

import busIcon from '../../assets/icons/bus.fill.svg';
import mappinIcon from '../../assets/icons/mappin.and.ellipse.svg';
import flagIcon from '../../assets/icons/flag.pattern.checkered.svg';
import chevronDownIcon from '../../assets/icons/chevron.down.svg';
import chevronUpIcon from '../../assets/icons/chevron.up.svg';
import refreshIcon from '../../assets/icons/arrow.clockwise.svg';
import searchIcon from '../../assets/icons/magnifyingglass.svg';
import houseIcon from '../../assets/icons/house.svg';
import houseFillIcon from '../../assets/icons/house.fill.svg';
import buildingIcon from '../../assets/icons/building.2.svg';
import buildingFillIcon from '../../assets/icons/building.2.fill.svg';
import { RouteSearchSheet } from './RouteSearchSheet';

type Category = 'minsk' | 'home';

function getTgUserId(): number {
  try {
    const tg = (window as any).Telegram?.WebApp;
    const id = tg?.initDataUnsafe?.user?.id;
    if (id) return id;

    const hash = window.location.hash;
    const searchStr = window.location.search || (hash.includes('?') ? hash.slice(hash.indexOf('?')) : '');
    const params = new URLSearchParams(searchStr);
    const data = params.get('tgWebAppData');
    if (data) {
      const inner = new URLSearchParams(data);
      const userJson = inner.get('user');
      if (userJson) return JSON.parse(userJson).id ?? 0;
    }

    const urlId = params.get('tg_id');
    if (urlId) return parseInt(urlId, 10);

    return 0;
  } catch {
    return 0;
  }
}

function getCurrentHour(): number {
  return new Date().getHours();
}

function formatTime(hour: number, min: string): string {
  return `${String(hour).padStart(2, '0')}:${min}`;
}

function getNextDepartures(hours: HourEntry[], count = 3): string[] {
  const now = new Date();
  const currentH = now.getHours();
  const currentM = now.getMinutes();
  const result: string[] = [];

  for (const entry of hours) {
    for (const m of entry.minutes) {
      const minNum = parseInt(m, 10);
      if (
        entry.hour > currentH ||
        (entry.hour === currentH && minNum >= currentM)
      ) {
        result.push(formatTime(entry.hour, m));
        if (result.length >= count) return result;
      }
    }
  }
  return result;
}

function ScheduleTable({ hours, label }: { hours: HourEntry[]; label?: string }) {
  const currentHour = getCurrentHour();

  if (!hours.length) {
    return <div className="gh-no-schedule">Нет рейсов</div>;
  }

  return (
    <div className="gh-schedule-table">
      {label && <div className="gh-schedule-label">{label}</div>}
      {hours.map((h) => (
        <div
          key={h.hour}
          className={`gh-hour-row ${h.hour === currentHour ? 'current' : ''}`}
        >
          <span className="gh-hour">{String(h.hour).padStart(2, '0')}</span>
          <span className="gh-minutes">
            {h.minutes.map((m, i) => (
              <span key={i} className="gh-min">{m}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

function RouteCard({ data }: { data: RouteSchedule }) {
  const [expanded, setExpanded] = useState(false);

  if (data.error) {
    return (
      <div className="gh-route-card error">
        <div className="gh-route-header">
          <div className="gh-route-title">
            <div className="gh-bus-badge">
              <img src={busIcon} alt="" className="gh-bus-icon" />
            </div>
            <span className="gh-route-number">{data.route_number}</span>
          </div>
          <span className="gh-route-error">Ошибка загрузки</span>
        </div>
      </div>
    );
  }

  const nextFrom = getNextDepartures(data.from.schedule.today, 3);
  const nextTo = getNextDepartures(data.to.schedule.today, 3);

  return (
    <div className={`gh-route-card ${expanded ? 'expanded' : ''}`}>
      <div className="gh-route-header" onClick={() => setExpanded(!expanded)}>
        <div className="gh-route-title">
          <div className="gh-bus-badge">
            <img src={busIcon} alt="" className="gh-bus-icon" />
          </div>
          <div className="gh-route-info">
            <span className="gh-route-number">{data.route_number}</span>
            <span className="gh-route-name">{data.route_name}</span>
          </div>
        </div>
        <img
          src={expanded ? chevronUpIcon : chevronDownIcon}
          alt=""
          className="gh-chevron-icon"
        />
      </div>

      <div className="gh-route-summary">
        <div className="gh-stop-preview">
          <img src={mappinIcon} alt="" className="gh-stop-icon" />
          <div className="gh-stop-info">
            <div className="gh-stop-label">{data.from.name}</div>
            <div className="gh-next-times">
              {nextFrom.length ? (
                nextFrom.map((t, i) => (
                  <span key={i} className={`gh-time-chip ${i === 0 ? 'nearest' : ''}`}>{t}</span>
                ))
              ) : (
                <span className="gh-time-chip none">—</span>
              )}
            </div>
          </div>
        </div>
        <div className="gh-route-connector" />
        <div className="gh-stop-preview">
          <img src={flagIcon} alt="" className="gh-stop-icon" />
          <div className="gh-stop-info">
            <div className="gh-stop-label">{data.to.name}</div>
            <div className="gh-next-times">
              {nextTo.length ? (
                nextTo.map((t, i) => (
                  <span key={i} className={`gh-time-chip ${i === 0 ? 'nearest' : ''}`}>{t}</span>
                ))
              ) : (
                <span className="gh-time-chip none">—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="gh-route-details">
          <div className="gh-detail-section">
            <div className="gh-detail-header">
              <img src={mappinIcon} alt="" className="gh-detail-icon" />
              <span className="gh-detail-title">{data.from.name}</span>
            </div>
            <ScheduleTable hours={data.from.schedule.today} label="Сегодня" />
            {data.from.schedule.days.map((d, i) => (
              <ScheduleTable key={i} hours={d.hours} label={d.label} />
            ))}
          </div>
          <div className="gh-detail-divider" />
          <div className="gh-detail-section">
            <div className="gh-detail-header">
              <img src={flagIcon} alt="" className="gh-detail-icon" />
              <span className="gh-detail-title">{data.to.name}</span>
            </div>
            <ScheduleTable hours={data.to.schedule.today} label="Сегодня" />
            {data.to.schedule.days.map((d, i) => (
              <ScheduleTable key={i} hours={d.hours} label={d.label} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function GoHomeScreen() {
  const [category, setCategory] = useState<Category>('minsk');
  const [schedules, setSchedules] = useState<RouteSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const tgId = getTgUserId();

  const loadSchedule = useCallback(async (cat: Category) => {
    setLoading(true);
    setError('');
    try {
      const uid = tgId || 0;
      const data = await getSchedule(uid, cat);
      setSchedules(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [tgId]);

  useEffect(() => {
    loadSchedule(category);
  }, [category, loadSchedule]);

  useEffect(() => {
    const interval = setInterval(() => loadSchedule(category), 60_000);
    return () => clearInterval(interval);
  }, [category, loadSchedule]);

  return (
    <div className="gh-screen">
      {/* Header */}
      <div className="gh-header">
        <div className="gh-header-title">
          <span className="gh-header-eyebrow">Расписание</span>
          <span className="gh-header-h1">
            {category === 'minsk' ? 'В Минск' : 'Домой'}
          </span>
        </div>
        <button
          className="gh-refresh-btn"
          onClick={() => loadSchedule(category)}
          disabled={loading}
          aria-label="Обновить"
        >
          <img src={refreshIcon} alt="" className={`gh-refresh-icon ${loading ? 'spinning' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="gh-content">
        {loading && !schedules.length && (
          <div className="gh-loading">
            <div className="gh-loading-dot" />
            <div className="gh-loading-dot" />
            <div className="gh-loading-dot" />
          </div>
        )}

        {error && (
          <div className="gh-error">{error}</div>
        )}

        {!loading && !error && schedules.length === 0 && (
          <div className="gh-empty">
            <img src={busIcon} alt="" className="gh-empty-icon" />
            <div className="gh-empty-text">Нет маршрутов</div>
            <div className="gh-empty-hint">Добавьте маршруты через бота</div>
          </div>
        )}

        {schedules.map((s, i) => (
          <RouteCard key={`${s.route_number}-${i}`} data={s} />
        ))}
      </div>

      {/* Search FAB */}
      <button
        className="gh-search-fab"
        onClick={() => setSearchOpen(true)}
        aria-label="Найти автобус"
      >
        <img src={searchIcon} alt="" className="gh-search-fab-icon" />
      </button>

      {/* TabBar */}
      <div className="gh-tabbar-wrapper">
        <nav className="gh-tabbar-pill">
          <div
            className="gh-tabbar-indicator"
            style={{ transform: `translateX(${category === 'minsk' ? 0 : 100}%)` }}
          />
          <button
            className={`gh-tabbar-item ${category === 'minsk' ? 'active' : ''}`}
            onClick={() => setCategory('minsk')}
          >
            <img
              src={category === 'minsk' ? buildingFillIcon : buildingIcon}
              alt=""
              className="gh-tabbar-icon"
            />
            <span className="gh-tabbar-label">В Минск</span>
          </button>
          <button
            className={`gh-tabbar-item ${category === 'home' ? 'active' : ''}`}
            onClick={() => setCategory('home')}
          >
            <img
              src={category === 'home' ? houseFillIcon : houseIcon}
              alt=""
              className="gh-tabbar-icon"
            />
            <span className="gh-tabbar-label">Домой</span>
          </button>
        </nav>
      </div>

      {searchOpen && (
        <RouteSearchSheet
          tgId={tgId}
          defaultCategory={category}
          onClose={() => setSearchOpen(false)}
          onAdded={() => {
            setSearchOpen(false);
            loadSchedule(category);
          }}
        />
      )}
    </div>
  );
}
