export default function LoginButton() {
    const handleClick = () => {
        // Redirect user straight to the backend login route
        window.location.href = 'https://feisty-renewal-production.up.railway.app/auth/login'
    };

    return (
        <button
            onClick={handleClick}
            style={{ 
                backgroundColor: 'blue', 
                color: 'white', 
                padding: '10px 20px', 
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                fontFamily: 'Arial, sans-serif'
            }}
        >
            Log In with Amazon
        </button>
    );
}