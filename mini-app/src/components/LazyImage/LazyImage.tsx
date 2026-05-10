import React, { useState, useRef, useEffect } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  useIntersection?: boolean;
  rootMargin?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  useIntersection = true,
  rootMargin = '300px',
  loading = 'lazy',
  decoding = 'async',
  alt = '',
  className = '',
  style,
  ...rest
}) => {
  const [inView, setInView] = useState(!useIntersection);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!useIntersection || !src || inView) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [useIntersection, src, rootMargin, inView]);

  const skeleton = (
    <div
      className="lazy-image-skeleton"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(255, 255, 255, 0.06)',
        animation: 'lazyImagePulse 1.5s ease-in-out infinite',
        borderRadius: 'inherit',
      }}
      aria-hidden
    />
  );

  if (!inView) {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          ...style,
        }}
        aria-hidden
      >
        {skeleton}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      {!loaded && skeleton}
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
        onLoad={() => setLoaded(true)}
        style={{
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
        {...rest}
      />
    </div>
  );
};
