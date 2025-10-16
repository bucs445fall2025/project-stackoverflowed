export default function LoginButton() {
    const handleClick = () => {
      // Redirect user straight to the backend login route
      window.location.href = 'https://feisty-renewal-production.up.railway.app/auth/login';
    };
  
    return (
      <>
        <button className="login-btn" onClick={handleClick}>
          Log In with Amazon
        </button>
  
        <style jsx>{`
          .login-btn {
            background-color: black;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            font-family: Arial, sans-serif;
            transition: transform 0.1s ease, box-shadow 0.1s ease;
          }
  
          /* hover gives slight lift */
          .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
          }
  
          /* active (click down) shrinks slightly */
          .login-btn:active {
            transform: scale(0.95);
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
          }
        `}</style>
      </>
    );
  }
  