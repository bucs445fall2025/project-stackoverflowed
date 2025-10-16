// components/StarsBackground.jsx
import { useMemo } from 'react';

export default function StarsBackground({ count = 400 }) {
  // generate stars once per mount
  const stars = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const size = Math.random() < 0.85 ? Math.random() * 2 + 1 : Math.random() * 3 + 2; // mostly small, some larger
      arr.push({
        id: i,
        top: Math.random() * 100,     // vh
        left: Math.random() * 100,    // vw
        size,
        delay: Math.random() * 6,     // s
        duration: 3 + Math.random() * 5, // s
        initialOpacity: 0.2 + Math.random() * 0.8
      });
    }
    return arr;
  }, [count]);

  return (
    <>
      <div className="stars" aria-hidden>
        {stars.map(s => (
          <span
            key={s.id}
            className="star"
            style={{
              top: `${s.top}vh`,
              left: `${s.left}vw`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
              opacity: s.initialOpacity,
              boxShadow: `0 0 ${Math.max(4, s.size * 2)}px rgba(255,255,255,0.8)`
            }}
          />
        ))}
      </div>

      <style jsx>{`
        .stars {
          position: absolute;
          inset: 0;
          overflow: hidden;
          z-index: 0; /* behind content */
          pointer-events: none;
        }
        .star {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(closest-side, #fff, rgba(255,255,255,0.4), transparent);
          animation-name: twinkle;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          will-change: opacity;
        }
        @keyframes twinkle {
          0%   { opacity: 0.1; }
          50%  { opacity: 1; }
          100% { opacity: 0.1; }
        }

        /* be respectful of motion preferences (keeps static stars) */
        @media (prefers-reduced-motion: reduce) {
          .star {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}
