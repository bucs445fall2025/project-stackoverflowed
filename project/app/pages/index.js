import LoginButton from '../components/loginButton';
import SignUpButton from '../components/signUpButton';
import StarsBackground from '../components/StarsBackground';

export default function Home() {
  return (
    <div className="home-wrap">
      {/* starfield behind everything */}
      <StarsBackground count={240} />

      <main className="content">
        <h1 className="home-title">Welcome to FBAlgo</h1>

        <div className="button-group">
          <LoginButton />
          <SignUpButton />
        </div>
      </main>

      {/* page-specific styles */}
      <style jsx>{`
        .home-wrap {
          position: relative;
          min-height: 100vh;
          background: linear-gradient(135deg, #360f5a, #1c0333);
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        .content {
          position: relative;
          z-index: 1; /* sit above stars */
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
          text-align: center;
          padding: 2rem;
        }
        .home-title {
          color: #fff;
          font-weight: 600;
          font-size: clamp(2rem, 3.5vw, 3rem);
          letter-spacing: 0.5px;
          margin-bottom: 0.75rem;
          text-shadow: 0 2px 24px rgba(0,0,0,0.35);
        }
        .button-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        .button-group :global(button) {
          background: #ff9900;
          color: #000000;
          border: none;
          padding: 12px 20px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: transform .08s ease;
        }
        .button-group :global(button:hover) {
          transform: translateY(-1px);
        }
        .button-group :global(a),
        .button-group :global(.signup-link) {
          color: #fff;
          text-decoration: underline;
          font-weight: 500;
          opacity: 0.95;
        }
      `}</style>

      {/* global styles that fix the border */}
      <style jsx global>{`
        html, body, #__next {
          height: 100%;
          background: #1b0633; /* match your page bg so there’s no white flash */
        }
        body {
          margin: 0; /* <-- removes the white border */
          overscroll-behavior: none;
        }
        * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}
