// components/StarsBackground.jsx
import { useMemo } from 'react';

export default function StarsBackground({
  count = 400,           // total stars (density)
  minSize = 1,           // px
  maxSize = 4,           // px
  minOpacity = 0.25,     // brightness lower bound
  maxOpacity = 1.0,      // brightness upper bound
  minTwinkle = 3,        // s  (animation duration)
  maxTwinkle = 7,        // s
  colors = ['#fff', '#ffe9c4', '#d4fbff'] // subtle color variety
}) {
  const stars = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const size =
        Math.random() < 0.85
          ? minSize + Math.random() * (maxSize - minSize)           // mostly small
          : Math.min(maxSize + 1.5, minSize + Math.random() * (maxSize + 1.5)); // a few bigger
      const baseOpacity = minOpacity + Math.random() * (maxOpacity - minOpacity);
      const color = colors[Math.floor(Math.random() * colors.length)];
      arr.push({
        id: i,
        top: Math.random() * 100,      // vh
        left: Math.random() * 100,     // vw
        size,
        delay: Math.random() * 6,      // s
        duration: minTwinkle + Math.random() * (maxTwinkle - minTwinkle),
        baseOpacity,
        color
      });
    }
    return arr;
  }, [count, minSize, maxSize, minOpacity, maxOpacity, minTwinkle, maxTwinkle, colors]);

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
              background: `radial-gradient(closest-side, ${s.color}, rgba(255,255,255,0.5), transparent)`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
              // set per-star twinkle range via CSS vars
              ['--min']: s.baseOpacity * 0.2,
              ['--max']: Math.min(1, s.baseOpacity),
              // crisp glow:
              boxShadow: `0 0 ${Math.max(4, s.size * 2)}px ${s.color}`
            }}
          />
        ))}
      </div>

      <style jsx>{`
        .stars {
          position: absolute;
          inset: 0;
          overflow: hidden;
          z-index: 0;
          pointer-events: none;
        }
        .star {
          position: absolute;
          border-radius: 50%;
          animation-name: twinkle;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          will-change: opacity;
          opacity: var(--min); /* starting opacity */
        }
        @keyframes twinkle {
          0%   { opacity: var(--min); }
          50%  { opacity: var(--max); }
          100% { opacity: var(--min); }
        }
        @media (prefers-reduced-motion: reduce) {
          .star { animation: none !important; }
        }
      `}</style>
    </>
  );
}
