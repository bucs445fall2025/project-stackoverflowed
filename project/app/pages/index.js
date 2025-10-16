import LoginButton from '../components/loginButton';
import SignUpButton from '../components/signUpButton';

export default function Home() {
  return (
    <div className="home-container">
      <h1 className="home-title">Welcome to FBAlgo</h1>
      
      <div className="button-group">
        <LoginButton />
        <SignUpButton />
      </div>

      <style jsx>{`
        .home-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background-color: #2c003e; /* deep purple */
          text-align: center;
          padding: 2rem;
        }

        .home-title {
          font-size: 2.5rem;
          font-weight: 600;
          color: white;
          margin-bottom: 3rem;
        }

        .button-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          align-items: center;
        }

        /* Style for login button */
        .button-group :global(button) {
          background-color: #ff9900; /* Amazon orange for login */
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.3s ease;
        }

        .button-group :global(button:hover) {
          background-color: #e68a00;
        }

        /* Style for sign-up as a link */
        .button-group :global(a),
        .button-group :global(.signup-link) {
          color: white;
          font-size: 1rem;
          text-decoration: underline;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
        }
      `}</style>
    </div>
  );
}
