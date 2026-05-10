import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { initData } from '@tma.js/sdk-react';
import crownFillIcon from '../../assets/icons/crown.fill.svg';

import LightRays from '@/components/LightRays/LightRays';
import {
  getConfig,
  getContestants,
  authVoter,
  castVote,
  getResults,
  subscribeResults,
  checkResultsAccess,
  resolvePhotoUrl,
  type AppConfig,
  type Contestant,
  type ResultsPayload,
} from '@/api/misterApi';

import './VotingScreen.css';
import './ResultsScreen.css';

type VoterState = {
  voter_id: number;
  firstName: string;
  lastName: string;
};

type Phase = 'loading' | 'auth' | 'voting' | 'results' | 'voted' | 'closed';

const VOTER_KEY = 'mister:voter:v2';

function loadVoter(): VoterState | null {
  try {
    const raw = localStorage.getItem(VOTER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveVoter(v: VoterState) {
  localStorage.setItem(VOTER_KEY, JSON.stringify(v));
}

export function clearVoter() {
  localStorage.removeItem(VOTER_KEY);
}

const AVATAR_CENTER_X = 50;
const AVATAR_CENTER_Y = 50;
const AVATAR_RADIUS_X = 38;
const AVATAR_RADIUS_Y = AVATAR_RADIUS_X;

function avatarAngle(index: number, total: number): number {
  return -90 + (360 / total) * index;
}

/** Lighten a hex color for light-rays effect */
function lightenHex(hex: string): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 40);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 40);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 40);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const MisterVotingScreen: React.FC = () => {
  const [accentColor, setAccentColor] = useState('#A855F7');

  const lightRays = useMemo(
    () => (
      <LightRays
        raysOrigin="top-center"
        raysColor={lightenHex(accentColor)}
        raysSpeed={0.6}
        lightSpread={1.8}
        rayLength={3.0}
        followMouse={false}
        pulsating
        fadeDistance={2.5}
        saturation={0.9}
        noiseAmount={0.04}
        distortion={0.03}
      />
    ),
    [accentColor],
  );

  const getTgId = (): number => {
    try { return initData.state()?.user?.id ?? 0; } catch { return 0; }
  };

  const [phase, setPhase] = useState<Phase>('loading');
  const [, setCanSeeResults] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [voter, setVoter] = useState<VoterState | null>(() => loadVoter());
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAnimatingVote, setIsAnimatingVote] = useState(false);
  const [flyingIndex, setFlyingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profile, setProfile] = useState('');
  const [parallel, setParallel] = useState('');

  const goToResultsPhase = useCallback(async () => {
    try {
      const { can_see } = await checkResultsAccess(getTgId());
      setCanSeeResults(can_see);
      setPhase(can_see ? 'results' : 'voted');
    } catch {
      setPhase('voted');
    }
  }, []);

  const texts = config?.texts ?? {};
  const t = (key: string, fallback: string) => texts[key] || fallback;

  // Apply accent color as CSS variable
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accentColor);
    root.style.setProperty('--accent-rgb', `${parseInt(accentColor.slice(1, 3), 16)}, ${parseInt(accentColor.slice(3, 5), 16)}, ${parseInt(accentColor.slice(5, 7), 16)}`);
  }, [accentColor]);

  // Load config, contestants, and check vote status
  useEffect(() => {
    Promise.all([getConfig(), getContestants()])
      .then(async ([cfg, cont]) => {
        setConfig(cfg);
        setContestants(cont);
        if (cfg.event.accent_color) {
          setAccentColor(cfg.event.accent_color);
        }

        if (!cfg.event.voting_enabled) {
          setPhase('closed');
          return;
        }

        if (!voter) {
          setPhase('auth');
          return;
        }

        // Saved voter — verify with server
        try {
          const res = await authVoter({
            first_name: voter.firstName,
            last_name: voter.lastName,
            profile: '',
            parallel: '',
            is_guest: false,
          });
          const updated: VoterState = { ...voter, voter_id: res.voter_id };
          saveVoter(updated);
          setVoter(updated);
          if (res.already_voted) {
            await goToResultsPhase();
          } else {
            setPhase('voting');
          }
        } catch {
          clearVoter();
          setVoter(null);
          setPhase('auth');
        }
      })
      .catch(() => setPhase('closed'));
  }, []);

  // SSE for results
  useEffect(() => {
    if (phase !== 'results') return;
    const unsub = subscribeResults((data) => setResults(data));
    // Also get initial results
    getResults().then(setResults).catch(() => {});
    return unsub;
  }, [phase]);

  const handleAuth = useCallback(
    async () => {
      setError(null);
      try {
        const res = await authVoter({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          profile,
          parallel,
          is_guest: false,
        });

        if (!res.access) {
          setError('У вас нет доступа к голосованию');
          return;
        }

        const v: VoterState = {
          voter_id: res.voter_id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        };
        saveVoter(v);
        setVoter(v);

        if (res.already_voted) {
          await goToResultsPhase();
        } else {
          setPhase('voting');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка авторизации');
      }
    },
    [firstName, lastName, profile, parallel, goToResultsPhase],
  );

  const handleVote = useCallback(async () => {
    if (isAnimatingVote || !voter || !contestants.length) return;
    setError(null);

    const target = contestants[selectedIndex];
    if (!target) return;

    setIsAnimatingVote(true);
    setFlyingIndex(selectedIndex);

    try {
      await castVote(voter.voter_id, target.id);
      setTimeout(async () => {
        setIsAnimatingVote(false);
        setFlyingIndex(null);
        await goToResultsPhase();
      }, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка голосования');
      setIsAnimatingVote(false);
      setFlyingIndex(null);
    }
  }, [isAnimatingVote, voter, contestants, selectedIndex]);

  const currentContestant = contestants[selectedIndex] ?? contestants[0];
  const needsParallel = profile !== '' && profile !== 'выпускник' && profile !== 'педагог';
  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && profile !== '' && (!needsParallel || parallel !== '');

  // ── Render ──────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="voting-screen">
        <div className="voting-galaxy-bg">{lightRays}</div>
        <div className="voting-success">
          <p className="voting-success-subtitle">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voting-screen">
      <div className="voting-galaxy-bg">{lightRays}</div>

      {/* Auth phase */}
      {phase === 'auth' && (
        <div className="voting-main">
          <header className="voting-header">
            <p className="voting-title-line-1">{t('auth_title', 'Представьтесь, пожалуйста')}</p>
            <p className="voting-title-line-2 voting-decorative">
              {t('auth_subtitle', 'перед голосованием')}
            </p>
          </header>

          <main className="voting-body" aria-label="Данные голосующего">
            <div className="voting-form">
              <label className="voting-field">
                <span className="voting-field-label">Имя</span>
                <input
                  className="voting-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Иван"
                  autoComplete="given-name"
                />
              </label>

              <label className="voting-field">
                <span className="voting-field-label">Фамилия</span>
                <input
                  className="voting-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Петров"
                  autoComplete="family-name"
                />
              </label>

              <label className="voting-field">
                <span className="voting-field-label">Профиль</span>
                <select
                  className="voting-input voting-select"
                  value={profile}
                  onChange={(e) => { setProfile(e.target.value); setParallel(''); }}
                >
                  <option value="">Выберите профиль</option>
                  <option value="педагог">Педагог</option>
                  <option value="выпускник">Выпускник</option>
                  <option value="ЭГ">ЭГ</option>
                  <option value="ГУМ">ГУМ</option>
                  <option value="ФИЛ">ФИЛ</option>
                  <option value="ХИМ">ХИМ</option>
                  <option value="БИО1">БИО1</option>
                  <option value="БИО2">БИО2</option>
                  <option value="ОБЩ">ОБЩ</option>
                  <option value="ИСТ">ИСТ</option>
                  <option value="МАТ">МАТ</option>
                  <option value="ФИЗ">ФИЗ</option>
                  <option value="ИФ">ИФ</option>
                  <option value="ИМ">ИМ</option>
                </select>
              </label>

              {profile && profile !== 'выпускник' && profile !== 'педагог' && (
                <label className="voting-field">
                  <span className="voting-field-label">Параллель</span>
                  <div className="voting-parallel">
                    <button
                      type="button"
                      className={`voting-parallel-btn${parallel === '10' ? ' active' : ''}`}
                      onClick={() => setParallel('10')}
                    >10</button>
                    <button
                      type="button"
                      className={`voting-parallel-btn${parallel === '11' ? ' active' : ''}`}
                      onClick={() => setParallel('11')}
                    >11</button>
                  </div>
                </label>
              )}

              <p className="voting-privacy-note">
                Мы проверяем имя и фамилию по списку зрителей, чтобы каждый мог проголосовать только один раз. Педагоги проходят без проверки.
              </p>

              <div className="voting-auth-actions">
                <button
                  type="button"
                  className="voting-cta-button"
                  onClick={() => handleAuth()}
                  disabled={!canSubmit}
                >
                  Продолжить
                </button>
                {error && <div className="voting-error">{error}</div>}
              </div>
            </div>
          </main>
        </div>
      )}

      {/* Closed phase */}
      {phase === 'closed' && (
        <div className="voting-success">
          <h1 className="voting-success-title">
            {config?.event?.title || t('main_title', 'Мистер лицей')}
          </h1>
          <p className="voting-success-subtitle">
            {t('voting_closed', 'Голосование ещё не открыто')}
          </p>
        </div>
      )}

      {/* Voting phase */}
      {phase === 'voting' && (
        <div className="voting-main">
          <header className="voting-header">
            <p className="voting-title-line-1">
              {t('main_title', 'Мистер лицей')}
            </p>
            <p className="voting-title-line-2 voting-decorative">
              {t('subtitle', '2026')}
            </p>
          </header>

          {config?.event.contest_type === 'class' ? (
            /* ── Class voting UI ── */
            <main className="voting-body" aria-label="Выбор класса">
              <div className="class-voting-grid">
                {contestants.map((c, index) => {
                  const isActive = index === selectedIndex;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`class-voting-btn${isActive ? ' class-voting-btn--active' : ''}`}
                      onClick={() => {
                        if (isAnimatingVote) return;
                        setSelectedIndex(index);
                      }}
                      disabled={isAnimatingVote}
                    >
                      <span className="class-voting-btn-name">{c.display_name}</span>
                      {c.description && (
                        <span className="class-voting-btn-desc">{c.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </main>
          ) : (
            /* ── Person voting UI ── */
            <main className="voting-body" aria-label="Выбор мистера">
              <div className="voting-grid-wrap">
                <div className="voting-grid">
                  <div
                    className={`voting-grid-center${
                      isAnimatingVote ? ' voting-grid-center--receive' : ''
                    }`}
                  >
                    <img src={crownFillIcon} alt="" className="voting-grid-center-image" />
                  </div>
                  {contestants.map((c, index) => {
                    const isActive = index === selectedIndex;
                    const isFlying = flyingIndex === index;
                    const angleDeg = avatarAngle(index, contestants.length);
                    const angleRad = (angleDeg * Math.PI) / 180;
                    const left = AVATAR_CENTER_X + AVATAR_RADIUS_X * Math.cos(angleRad);
                    const top = AVATAR_CENTER_Y + AVATAR_RADIUS_Y * Math.sin(angleRad);

                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`voting-avatar${isActive ? ' voting-avatar--active' : ''}${
                          isFlying ? ' voting-avatar--fly' : ''
                        }`}
                        onClick={() => {
                          if (isAnimatingVote) return;
                          setSelectedIndex(index);
                        }}
                        style={{ left: `${left}%`, top: `${top}%` }}
                        disabled={isAnimatingVote}
                      >
                        <div className="voting-avatar-ring">
                          <div className="voting-avatar-inner">
                            {c.photo_url ? (
                              <img
                                src={resolvePhotoUrl(c.photo_url)}
                                alt={c.display_name}
                                className="voting-avatar-image"
                                width={100}
                                height={100}
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="voting-avatar-placeholder">
                                {c.name.charAt(0)}
                                {c.surname.charAt(0)}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="voting-selected-name voting-decorative">
                {currentContestant?.display_name}
              </div>
            </main>
          )}

          <div className="voting-cta-wrap">
            <button
              type="button"
              className="voting-cta-button"
              onClick={handleVote}
              disabled={isAnimatingVote}
            >
              {t('vote_button_text', 'Голосовать')}
            </button>
            {error && <div className="voting-error">{error}</div>}
          </div>
        </div>
      )}

      {/* Voted but results hidden */}
      {phase === 'voted' && (
        <div className="voting-success">
          <h1 className="voting-success-title">{t('thank_you_title', 'Спасибо за голос!')}</h1>
          <p className="voting-success-subtitle">{t('thank_you_text', 'Ваш голос учтён.')}</p>
        </div>
      )}

      {/* Results phase */}
      {phase === 'results' && (
        <div className="voting-main">
          <header className="voting-header">
            <p className="voting-title-line-1">
              {t('thank_you_title', 'Спасибо за голос!')}
            </p>
            <p className="voting-title-line-2 voting-decorative">
              {t('results_title', 'Результаты')}
            </p>
          </header>

          <main className="voting-body results-body">
            {results && (
              <>
                <div className="results-list">
                  {results.contestants.map((r) => (
                    <div key={r.id} className="results-item">
                      <div className="results-item-info">
                        <span className="results-item-name">{r.display_name}</span>
                        <span className="results-item-votes">
                          {r.votes} ({r.percentage}%)
                        </span>
                      </div>
                      <div className="results-bar-bg">
                        <div
                          className="results-bar-fill"
                          style={{ width: `${Math.max(r.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="results-total">
                  Всего голосов: {results.total_votes}
                </div>
              </>
            )}
            {!results && (
              <p className="voting-success-subtitle">Загрузка результатов...</p>
            )}
          </main>
        </div>
      )}

    </div>
  );
};
