import React, {
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useState,
  type CSSProperties,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { misses } from '@/data/misses';
import { getAvailableMisses } from '@/utils/date';
import type { DisplayMiss } from '@/types/miss';
import Galaxy from '@/components/Galaxy/Galaxy';
import { Footer } from '@/components/Footer/Footer';
import { useVisibility } from '@/hooks/useVisibility';
import misskaWho from '../../assets/miski_main/misska_who.png';
import planetWhat from '../../assets/miski_main/planet_what.png';
import './MissesScreen.css';

export const MissesScreen: React.FC = () => {
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

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  const rafRef = useRef(0);
  const visibility = useVisibility();

  const allOrdered = useMemo(
    () => [...misses].sort((a, b) => a.order - b.order),
    [],
  );

  const initialMissId = searchParams.get('miss');

  const initialIndex = useMemo(() => {
    if (!initialMissId) return 0;
    const idx = allOrdered.findIndex((m) => m.id === initialMissId);
    return idx >= 0 ? idx : 0;
  }, [allOrdered, initialMissId]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const availableIds = useMemo(
    () => new Set(getAvailableMisses(misses).map((m) => m.id)),
    [],
  );

  const displayMisses: DisplayMiss[] = useMemo(
    () =>
      allOrdered.map((m) => {
        const isVisibleByApi = !visibility || visibility[m.id] !== false;
        const isAvailableByDate = availableIds.has(m.id);
        const isPublished = m.isPublished !== false;

        return {
          ...m,
          // Открытая миска: и доступна по дате, и не скрыта API, и включена в коде.
          // Закрытая миска остаётся в списке, но available=false и маскируется.
          available: isVisibleByApi && isAvailableByDate && isPublished,
        };
      }),
    [allOrdered, visibility, availableIds],
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const vh = container.clientHeight;
    const targetIndex = initialIndex;

    container.scrollTo({
      top: vh * targetIndex,
      left: 0,
      behavior: 'auto',
    });

    setActiveIndex(targetIndex);
  }, [initialIndex]);

  const updateSections = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const vh = container.clientHeight;

    sectionsRef.current.forEach((section, i) => {
      if (!section) return;

      const sectionTop = i * vh;
      const offset = (scrollTop - sectionTop) / vh;
      const absOffset = Math.abs(offset);

      const planetScale = Math.max(0.7, 1 - absOffset * 0.3);
      const planetOpacity = Math.max(0, 1 - absOffset * 2);
      const planetY = offset * -50;

      const contentOpacity = Math.max(0, 1 - absOffset * 3);
      const contentY = offset * -30;

      const photoScale = Math.max(0.88, 1 - absOffset * 0.12);
      const photoOpacity = Math.max(0, 1 - absOffset * 2.2);
      const photoY = offset * 40;

      const glowScale = Math.max(0.5, 1 - absOffset * 0.5);
      const glowOpacity = Math.max(0, 1 - absOffset * 2);

      section.style.setProperty('--p-scale', String(planetScale));
      section.style.setProperty('--p-opacity', String(planetOpacity));
      section.style.setProperty('--p-y', `${planetY}px`);
      section.style.setProperty('--c-opacity', String(contentOpacity));
      section.style.setProperty('--c-y', `${contentY}px`);
      section.style.setProperty('--ph-scale', String(photoScale));
      section.style.setProperty('--ph-opacity', String(photoOpacity));
      section.style.setProperty('--ph-y', `${photoY}px`);
      section.style.setProperty('--g-scale', String(glowScale));
      section.style.setProperty('--g-opacity', String(glowOpacity));
    });

    const newActive = Math.round(scrollTop / vh);
    setActiveIndex(Math.min(newActive, displayMisses.length - 1));
  }, [displayMisses.length]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateSections);
    };

    updateSections();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateSections]);

  const setSectionRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      sectionsRef.current[index] = el;
    },
    [],
  );

  const visibleFrom = Math.max(0, activeIndex - 1);
  const visibleTo = Math.min(displayMisses.length - 1, activeIndex + 1);

  const handleMissTap = useCallback(
    (miss: DisplayMiss) => {
      if (miss.available) {
        navigate(`/miss/${miss.id}`);
      }
    },
    [navigate],
  );

  return (
    <>
      <div className="misses-galaxy-bg">
        {galaxy}
      </div>
      <div className="misses-screen" ref={scrollRef}>
        {displayMisses.map((miss, index) => {
          const isLocked = !miss.available;

          const sectionClass = [
            'miss-section',
            isLocked && 'miss-section--locked',
            !isLocked && 'miss-section--tappable',
          ]
            .filter(Boolean)
            .join(' ');

          const sectionVars = {
            '--section-bg': miss.theme.background,
            '--section-glow': miss.theme.glow,
            '--section-text': miss.theme.text,
            '--section-accent': miss.theme.accent,
          } as CSSProperties;

          const maskMap: Record<string, { first: number; last: number }> = {
            // Порядок масок соответствует массиву мисок:
            // nastya, ksyusha, emiliya, angelina, adelya, polina, sonya
            nastya: { first: 10, last: 7 },
            ksyusha: { first: 10, last: 4 },
            emiliya: { first: 9, last: 4 },
            angelina: { first: 7, last: 6 },
            adelya: { first: 9, last: 7 },
            polina: { first: 8, last: 6 },
            sonya: { first: 8, last: 5 },
          };

          const maskConfig = maskMap[miss.id];
          const maskedFirstName =
            isLocked && maskConfig ? '?'.repeat(maskConfig.first) : miss.firstName;
          const maskedLastName =
            isLocked && maskConfig && miss.lastName
              ? '?'.repeat(maskConfig.last)
              : miss.lastName;

          const planetSrc = isLocked ? planetWhat : miss.planetImage;
          const photoSrc = isLocked ? misskaWho : miss.previewImage;

          return (
            <section
              key={miss.id}
              ref={setSectionRef(index)}
              className={sectionClass}
              style={sectionVars}
              onClick={() => handleMissTap(miss)}
            >
              <div className={`miss-glow miss-glow--${miss.planetPosition}`} />

              <div className={`miss-planet miss-planet--${miss.planetPosition}`}>
                {index >= visibleFrom && index <= visibleTo ? (
                  <img
                    src={planetSrc}
                    alt=""
                    className="miss-planet__img"
                    draggable={false}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    width={140}
                    height={140}
                  />
                ) : (
                  <div className="miss-planet__placeholder" aria-hidden />
                )}
              </div>

              <div className="miss-content">
                  <div className="miss-photo">
                    {index >= visibleFrom && index <= visibleTo ? (
                      <img
                        src={photoSrc}
                        alt={miss.firstName}
                        className="miss-photo__img"
                        draggable={false}
                        loading={index === activeIndex ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchPriority={index === activeIndex ? 'high' : undefined}
                        width={240}
                        height={320}
                      />
                    ) : (
                      <div className="miss-photo__placeholder" aria-hidden />
                    )}
                  </div>

                  <div className="miss-info">
                    <h2 className="miss-info__name">
                      {maskedFirstName}
                      {maskedLastName ? ` ${maskedLastName}` : ''}
                    </h2>
                    {!isLocked && (
                      <span className="miss-info__cta">
                        Открыть интервью
                      </span>
                    )}
                  </div>
                </div>
            </section>
          );
        })}
        <Footer />
      </div>

      <div className="miss-progress">
        {displayMisses.map((_, i) => (
          <div
            key={i}
            className={`miss-progress__dot${i === activeIndex ? ' miss-progress__dot--active' : ''}`}
          />
        ))}
      </div>
    </>
  );
};
