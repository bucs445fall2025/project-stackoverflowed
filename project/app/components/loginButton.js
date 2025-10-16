import { useState } from 'react';

export default function LoginButton() {
  const [launching, setLaunching] = useState(false);

  const handleClick = () => {
    setLaunching(true);
    setTimeout(() => {
      window.location.href = 'https://feisty-renewal-production.up.railway.app/auth/login';
    }, 1000);
  };

  return (
    <>
      <button
        className={`login-btn ${launching ? 'launch' : ''}`}
        onClick={handleClick}
        disabled={launching}
      >
        🚀
      </button>

      <style jsx>{`
        .login-btn {
          background: none; /* transparent */
          border: none;
          cursor: pointer;
          font-size: 48px; /* bigger rocket */
          transition: transform 0.1s ease;
        }

        /* hover wiggle */
        .login-btn:hover {
          transform: translateY(-2px);
        }

        /* press shrink */
        .login-btn:active {
          transform: scale(0.95);
        }

        /* launch animation */
        .login-btn.launch {
          animation: takeoff 1s forwards;
        }

        @keyframes takeoff {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          40%  { transform: translateY(-50px) scale(1.1); }
          70%  { transform: translateY(-120px) scale(0.9); }
          100% { transform: translateY(-300px) scale(0.5); opacity: 0; }
        }
      `}</style>
    </>
  );
}
