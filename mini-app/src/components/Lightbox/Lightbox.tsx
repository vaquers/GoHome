import React, { useState, useCallback, useEffect, useRef } from 'react';
import './Lightbox.css';

interface LightboxProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  images,
  initialIndex,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, handlePrev, handleNext]);

  useEffect(() => {
    [currentIndex - 1, currentIndex + 1].forEach((i) => {
      if (i >= 0 && i < images.length && images[i]) {
        const img = new Image();
        img.src = images[i];
      }
    });
  }, [currentIndex, images]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current) return;
      const dx = e.changedTouches[0].clientX - touchRef.current.x;
      const dy = e.changedTouches[0].clientY - touchRef.current.y;
      touchRef.current = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) handlePrev();
        else handleNext();
      }
    },
    [handlePrev, handleNext],
  );

  return (
    <div
      className="lightbox"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button className="lightbox__close" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 505.813 506.313" fill="none">
          <path d="M464.032 7.78156L7.03156 464.782C-2.21844 474.032-2.46844 489.782 7.03156 499.282C16.7816 508.532 32.2816 508.532 41.7816 499.282L498.532 42.2816C508.032 33.0316 508.282 17.2816 498.532 7.78156C489.032-1.46844 473.532-1.71844 464.032 7.78156ZM498.532 464.782L41.7816 7.78156C32.2816-1.46844 16.5316-1.71844 7.03156 7.78156C-2.21844 17.5316-2.21844 33.0316 7.03156 42.2816L464.032 499.282C473.282 508.532 489.282 508.782 498.532 499.282C508.032 489.532 508.032 474.032 498.532 464.782Z" fill="currentColor" fillOpacity="0.85"/>
        </svg>
      </button>
      <div className="lightbox__counter">
        {currentIndex + 1} / {images.length}
      </div>
      <div
        className="lightbox__content"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          key={currentIndex}
          src={images[currentIndex]}
          alt=""
          className="lightbox__img"
          draggable={false}
          decoding="async"
        />
      </div>
      {images.length > 1 && (
        <>
          <button
            className="lightbox__nav lightbox__nav--prev"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
          >
            <svg width="12" height="17" viewBox="0 0 390 545.75" fill="none">
              <path d="M0 272.75C0 279.75 2.75 285.75 8 291L265 538.25C269.75 542.75 275.75 545.5 282.75 545.5C296.75 545.5 307.75 534.75 307.75 520.5C307.75 513.5 305 507.5 300.5 503L61 272.75L300.5 42.25C305 37.75 307.75 31.5 307.75 24.75C307.75 10.5 296.75 0 282.75 0C275.75 0 269.75 2.5 265 7.25L8 254.5C2.75 259.5 0 265.5 0 272.75Z" fill="currentColor" fillOpacity="0.85"/>
            </svg>
          </button>
          <button
            className="lightbox__nav lightbox__nav--next"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          >
            <svg width="12" height="17" viewBox="0 0 390 545.75" fill="none">
              <path d="M390 272.75C390 265.5 387.25 259.5 382 254.5L125 7.25C120.25 2.5 114.25 0 107.25 0C93.25 0 82.25 10.5 82.25 24.75C82.25 31.5 85 37.75 89.5 42.25L329 272.75L89.5 503C85 507.5 82.25 513.5 82.25 520.5C82.25 534.75 93.25 545.5 107.25 545.5C114.25 545.5 120.25 542.75 125 538.25L382 291C387.25 285.75 390 279.75 390 272.75Z" fill="currentColor" fillOpacity="0.85"/>
            </svg>
          </button>
        </>
      )}
    </div>
  );
};
