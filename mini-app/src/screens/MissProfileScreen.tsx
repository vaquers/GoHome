import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { misses, getMissGallery } from '@/data/misses';
import { Lightbox } from '@/components/Lightbox/Lightbox';
import { Footer } from '@/components/Footer/Footer';
import { LazyImage } from '@/components/LazyImage/LazyImage';
import './MissProfileScreen.css';

export const MissProfileScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ?? null;

  const miss = useMemo(() => misses.find((m) => m.id === id), [id]);

  const gallery = useMemo(() => {
    if (!id) return [];
    return getMissGallery(id);
  }, [id]);

  const handleGalleryClick = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  useEffect(() => {
    if (location.hash !== '#gallery') return;
    const el = galleryRef.current;
    if (!el) return;

    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    return () => window.clearTimeout(t);
  }, [location.hash, id]);

  if (!miss) {
    return (
      <div className="profile-screen">
        <div className="profile-empty">
          <p className="profile-empty__text">Участница не найдена</p>
          <button className="profile-empty__back" onClick={() => navigate('/')}>
            ← На главную
          </button>
        </div>
      </div>
    );
  }

  const fullName = miss.lastName
    ? `${miss.firstName} ${miss.lastName}`
    : miss.firstName;

  const heroSrc = miss.heroImage || miss.previewImage;

  return (
    <>
      <div className="profile-screen">
        <div className="profile-bg">
          <img
            src={heroSrc}
            alt=""
            className="profile-bg__img"
            draggable={false}
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
          <div className="profile-bg__overlay" />
        </div>

        <div className="profile-nav">
          <button
            className="profile-nav__btn"
            onClick={() => navigate(returnTo ?? '/')}
            aria-label="Закрыть"
          >
            <svg width="16" height="13" viewBox="0 0 599 484.25" fill="none">
              <path d="M242 484C255.75 484 266 474 266 460.5C266 454 263.75 447.5 259.5 443L171.75 354.5L49.75 242L171.75 129.5L259.5 40.75C263.75 36.25 266 30 266 23.5C266 10 255.75 0 242 0C235.5 0 229.5 2.25 223 8.75L8.25 223.75C2.75 229 0 235.25 0 242C0 248.75 2.75 255 8.25 260L224.5 476.5C230 481.5 235.5 484 242 484ZM147.75 266.25L575 266.25C589 266.25 599 256 599 242C599 227.75 589 217.75 575 217.75L147.75 217.75L49.25 223C38.25 223 30.25 230.75 30.25 242C30.25 253 38.25 260.75 49.5 260.75Z" fill="currentColor" fillOpacity="0.85"/>
            </svg>
          </button>
        </div>

        <div className="profile-hero">
          <img
            src={heroSrc}
            alt={fullName}
            className="profile-hero__img"
            draggable={false}
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
          <div className="profile-hero__gradient" />
          <div className="profile-hero__identity">
            <h1 className="profile-hero__name">{fullName}</h1>
            {miss.username && (
              <p className="profile-hero__username">{miss.username}</p>
            )}
          </div>
        </div>

        <div className="profile-sheet">
          <div className="profile-sheet__inner">
            <div className="profile-actions">
              {miss.instagramUrl ? (
                <a
                  className="profile-instagram-btn"
                  href={miss.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="2" width="20" height="20" rx="5" stroke="#111" strokeWidth="2"/>
                    <circle cx="12" cy="12" r="5" stroke="#111" strokeWidth="2"/>
                    <circle cx="17.5" cy="6.5" r="1.5" fill="#111"/>
                  </svg>
                  Instagram
                </a>
              ) : (
                <span className="profile-instagram-btn" style={{ opacity: 0.5, cursor: 'default' }}>
                  Instagram
                </span>
              )}
            </div>

            {miss.className && (
              <div className="profile-info">
                <div className="profile-info__chip">
                  <span className="profile-info__chip-value">{miss.className}</span>
                </div>
              </div>
            )}

            {miss.interview && miss.interview.length > 0 ? (
              <div className="profile-interview">
                {miss.interview.map((qa, i) => (
                  <div key={i} className="profile-interview__item">
                    <p className="profile-interview__question">{qa.question}</p>
                    <p className="profile-interview__answer">{qa.answer}</p>
                  </div>
                ))}
              </div>
            ) : miss.description ? (
              <div className="profile-bio">
                <p className="profile-bio__text">{miss.description}</p>
              </div>
            ) : null}

            {gallery.length > 0 && (
              <div className="profile-gallery-section" id="gallery" ref={galleryRef}>
                <h2 className="profile-gallery-title">Фото</h2>
                <div className="profile-gallery">
                  {gallery.map((photo, i) => (
                    <button
                      key={i}
                      className="profile-gallery__item"
                      onClick={() => handleGalleryClick(i)}
                    >
                      <LazyImage
                        src={photo}
                        alt={`${miss.firstName} ${i + 1}`}
                        className="profile-gallery__img"
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                        useIntersection={true}
                        rootMargin="300px"
                        width={300}
                        height={400}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Footer />
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={gallery}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
};
