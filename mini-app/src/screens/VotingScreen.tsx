import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { initData } from '@tma.js/sdk-react';

import { misses } from '@/data/misses';
import Galaxy from '@/components/Galaxy/Galaxy';
import { Footer } from '@/components/Footer/Footer';
import crownImg from '../../assets/miski_main/crown.png';
import { getParticipants, vote, getVotingStatus, type VotingNomination, type VotingStatusDto } from '@/api/votingApi';

import './VotingScreen.css';

type VoterInfo = {
  firstName: string;
  lastName: string;
  voterClass: string;
};

type VotingStage = 'defile' | 'photos' | 'success';

const VOTING_STAGES: Record<Exclude<VotingStage, 'success'>, { line1: string; line2: string }> = {
  defile: { line1: 'Какая мисска', line2: 'тебе больше всего понравилась?' },
  photos: { line1: 'Чья фотосессия', line2: 'понравилась больше?' },
};

const VOTER_STORAGE_KEY = 'miski:voting:voter';

function loadVoter(): VoterInfo | null {
  try {
    const raw = localStorage.getItem(VOTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VoterInfo>;
    if (!parsed.firstName || !parsed.lastName || !parsed.voterClass) return null;
    return {
      firstName: String(parsed.firstName).trim(),
      lastName: String(parsed.lastName).trim(),
      voterClass: String(parsed.voterClass).trim(),
    };
  } catch {
    localStorage.removeItem(VOTER_STORAGE_KEY);
    return null;
  }
}

function saveVoter(voter: VoterInfo) {
  try {
    localStorage.setItem(VOTER_STORAGE_KEY, JSON.stringify(voter));
  } catch {}
}

const AVATAR_CENTER_X = 50;
const AVATAR_CENTER_Y = 50;
const AVATAR_RADIUS_X = 38;
const AVATAR_RADIUS_Y = AVATAR_RADIUS_X;

const AVATAR_ANGLES_DEG = [-90, -45, 0, 45, 90, 135, 180, 225] as const;

export const VotingScreen: React.FC = () => {
  const navigate = useNavigate();

  const galaxy = useMemo(
    () => (
      <Galaxy
        mouseRepulsion={false}
        mouseInteraction={false}
        density={0.8}
        glowIntensity={0.3}
        saturation={0}
        hueShift={140}
        twinkleIntensity={0.3}
        rotationSpeed={0.1}
        repulsionStrength={2}
        autoCenterRepulsion={0}
        starSpeed={0.5}
        speed={0.8}
        transparent={false}
        maxFps={30}
        resolutionScale={0.65}
      />
    ),
    [],
  );

  const localParticipants = useMemo(
    () =>
      [...misses]
        .sort((a, b) => a.order - b.order)
        .map((miss, index) => ({
          id: index + 1,
          localId: miss.id,
          name: `${miss.firstName} ${miss.lastName}`.trim(),
          image: miss.previewImage,
        })),
    [],
  );

  const tgId = useMemo(() => {
    try {
      const userId = initData.state()?.user?.id;
      return typeof userId === 'number' ? userId : null;
    } catch {
      return null;
    }
  }, []);

  const [stage, setStage] = useState<VotingStage>('defile');
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [flyingIndex, setFlyingIndex] = useState<number | null>(null);
  const [isAnimatingVote, setIsAnimatingVote] = useState(false);
  const [pendingStage, setPendingStage] = useState<VotingStage | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voter, setVoter] = useState<VoterInfo | null>(() => loadVoter());
  const [voterFirstName, setVoterFirstName] = useState('');
  const [voterLastName, setVoterLastName] = useState('');
  const [voterClass, setVoterClass] = useState('');
  const [remoteParticipants, setRemoteParticipants] = useState<
    { id: number; localId?: string; name: string; image: string }[] | null
  >(null);
  const [votingOpen, setVotingOpen] = useState<VotingStatusDto | null>(null);

  const participants = remoteParticipants ?? localParticipants;
  const currentParticipant = participants[selectedIndex] ?? participants[0];

  useEffect(() => {
    let alive = true;
    const poll = () => {
      getVotingStatus().then((s) => { if (alive) setVotingOpen(s); }).catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 10_000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    getParticipants(ctrl.signal)
      .then((list) => {
        if (ctrl.signal.aborted) return;
        const localByName = new Map(
          localParticipants.map((p) => [p.name.toLowerCase(), p]),
        );
        const merged = (Array.isArray(list) ? list : [])
          .map((p) => {
            const id = Number((p as any).id ?? 0);
            if (!id) return null;
            const name =
              (p as any).name ||
              `${(p as any).firstName ?? (p as any).first_name ?? ''} ${(p as any).lastName ?? (p as any).last_name ?? ''}`.trim() ||
              String(id);
            const localMatch = localByName.get(name.toLowerCase());
            return {
              id,
              localId: localMatch?.localId,
              name,
              image: localMatch?.image || (p as any).previewImage || (p as any).preview_image || '',
            };
          })
          .filter(Boolean) as { id: number; localId?: string; name: string; image: string }[];

        if (merged.length) setRemoteParticipants(merged);
      })
      .catch(() => {});

    return () => ctrl.abort();
  }, [localParticipants]);

  const handleVote = useCallback(() => {
    if (isAnimatingVote || !participants.length || !voter) return;
    setVoteError(null);

    if (!tgId) {
      setVoteError('Не удалось получить tg id пользователя.');
      return;
    }

    const target = currentParticipant;
    if (!target) return;

    const nextStage: VotingStage | null =
      stage === 'defile' ? 'photos' : stage === 'photos' ? 'success' : null;

    if (!nextStage) return;

    setIsAnimatingVote(true);
    setFlyingIndex(selectedIndex);
    setPendingStage(nextStage);

    const nomination: VotingNomination = stage === 'photos' ? 'photos' : 'defile';

    vote({
      tg_id: tgId,
      first_name: voter.firstName,
      last_name: voter.lastName,
      voter_class: voter.voterClass,
      participant_id: target.id,
      nomination,
    }).catch((e) => {
      setVoteError(
        e instanceof Error ? e.message : 'Не удалось отправить голос. Попробуй ещё раз.',
      );
      setPendingStage(null);
      setFlyingIndex(null);
      setIsAnimatingVote(false);
    });
  }, [isAnimatingVote, participants.length, tgId, currentParticipant, selectedIndex, voter, stage]);

  useEffect(() => {
    if (!isAnimatingVote || !pendingStage) return;

    const timeout = window.setTimeout(() => {
      setStage(pendingStage);
      if (pendingStage === 'success') {
        setIsSuccess(true);
      } else {
        setSelectedIndex(0);
      }
      setPendingStage(null);
      setFlyingIndex(null);
      setIsAnimatingVote(false);
    }, 1850);

    return () => window.clearTimeout(timeout);
  }, [isAnimatingVote, pendingStage]);

  const isPhotosStage = stage === 'photos';
  const isAdmin = tgId === 5584466914;
  const stageOpen = isAdmin || (votingOpen ? votingOpen[stage as keyof VotingStatusDto] ?? false : false);

  const canSubmitVoter =
    voterFirstName.trim().length > 0 &&
    voterLastName.trim().length > 0 &&
    voterClass.trim().length > 0;

  const handleSubmitVoter = useCallback(() => {
    if (!canSubmitVoter) return;
    const next: VoterInfo = {
      firstName: voterFirstName.trim(),
      lastName: voterLastName.trim(),
      voterClass: voterClass.trim(),
    };
    saveVoter(next);
    setVoter(next);
  }, [canSubmitVoter, voterFirstName, voterLastName, voterClass]);

  if (!participants.length) {
    return (
      <div className="voting-screen">
        <div className="voting-galaxy-bg">{galaxy}</div>
        <div className="voting-success">
          <p className="voting-success-subtitle">Загрузка участниц…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voting-screen">
      <div className="voting-galaxy-bg">{galaxy}</div>

      {!voter && (
        <div className="voting-main">
          <header className="voting-header">
            <p className="voting-title-line-1">Перед голосованием</p>
            <p className="voting-title-line-2 voting-decorative">
              представься, пожалуйста.
            </p>
          </header>

          <main className="voting-body" aria-label="Данные голосующего">
            <div className="voting-form">
              <label className="voting-field">
                <span className="voting-field-label">Имя</span>
                <input
                  className="voting-input"
                  value={voterFirstName}
                  onChange={(e) => setVoterFirstName(e.target.value)}
                  placeholder="Иван"
                  autoComplete="given-name"
                />
              </label>

              <label className="voting-field">
                <span className="voting-field-label">Фамилия</span>
                <input
                  className="voting-input"
                  value={voterLastName}
                  onChange={(e) => setVoterLastName(e.target.value)}
                  placeholder="Петров"
                  autoComplete="family-name"
                />
              </label>

              <label className="voting-field">
                <span className="voting-field-label">Класс</span>
                <input
                  className="voting-input"
                  value={voterClass}
                  onChange={(e) => setVoterClass(e.target.value)}
                  placeholder="10А"
                  autoComplete="off"
                />
              </label>
            </div>
          </main>

          <div className="voting-cta-wrap">
            <button
              type="button"
              className="voting-cta-button"
              onClick={handleSubmitVoter}
              disabled={!canSubmitVoter}
            >
              Продолжить
            </button>
          </div>
        </div>
      )}

      {!isSuccess && voter && !stageOpen && (
        <div className="voting-success">
          <h1 className="voting-success-title">Голосование закрыто</h1>
          <p className="voting-success-subtitle">
            {stage === 'defile'
              ? 'Голосование за дефиле ещё не открыто.'
              : 'Голосование за фотосессию ещё не открыто.'}
          </p>
        </div>
      )}

      {!isSuccess && voter && stageOpen && (
        <div className="voting-main">
          <header className="voting-header">
            <p className="voting-title-line-1">
              {VOTING_STAGES[stage as keyof typeof VOTING_STAGES]?.line1}
            </p>
            <p className="voting-title-line-2 voting-decorative">
              {VOTING_STAGES[stage as keyof typeof VOTING_STAGES]?.line2}
            </p>
          </header>

          <main className="voting-body" aria-label="Выбор участницы">
            <div className="voting-grid-wrap">
              <div className="voting-grid">
                <div
                  className={`voting-grid-center${
                    isAnimatingVote ? ' voting-grid-center--receive' : ''
                  }`}
                >
                  <img
                    src={crownImg}
                    alt="Корона"
                    className="voting-grid-center-image"
                  />
                </div>
                {participants.map((participant, index) => {
                  const isActive = index === selectedIndex;
                  const isFlying = flyingIndex === index;
                  const angleDeg = AVATAR_ANGLES_DEG[index % AVATAR_ANGLES_DEG.length];
                  const angleRad = (angleDeg * Math.PI) / 180;
                  const left = AVATAR_CENTER_X + AVATAR_RADIUS_X * Math.cos(angleRad);
                  const top = AVATAR_CENTER_Y + AVATAR_RADIUS_Y * Math.sin(angleRad);
                  const position = {
                    left: `${left}%`,
                    top: `${top}%`,
                  };

                  return (
                    <button
                      key={participant.id}
                      type="button"
                      className={`voting-avatar${isActive ? ' voting-avatar--active' : ''}${
                        isFlying ? ' voting-avatar--fly' : ''
                      }`}
                      onClick={() => {
                        if (isAnimatingVote) return;
                        setSelectedIndex(index);
                      }}
                      style={position}
                      disabled={isAnimatingVote}
                    >
                      <div className="voting-avatar-ring">
                        <div className="voting-avatar-inner">
                          <img
                            src={participant.image}
                            alt={participant.name}
                            className="voting-avatar-image"
                            width={100}
                            height={100}
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="voting-selected-name voting-decorative">
              {currentParticipant?.name}
            </div>
          </main>

          <div className="voting-cta-wrap">
            {isPhotosStage && currentParticipant?.localId && (
              <button
                type="button"
                className="voting-secondary-button"
                onClick={() =>
                  navigate(`/miss/${currentParticipant.localId}#gallery`, {
                    state: { returnTo: '/voting' },
                  })
                }
                disabled={isAnimatingVote}
              >
                Открыть фотосессию
              </button>
            )}
            <button
              type="button"
              className="voting-cta-button"
              onClick={handleVote}
              disabled={isAnimatingVote}
            >
              Голосовать
            </button>
            {voteError && <div className="voting-error">{voteError}</div>}
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="voting-success">
          <h1 className="voting-success-title">Спасибо за голос!</h1>
          <p className="voting-success-subtitle">
            Ваш выбор в обеих номинациях учтён.
          </p>
        </div>
      )}

      <Footer />
    </div>
  );
};
