export default function LoginButton() {
    const handleClick = () => {
        // Redirect user straight to the backend login route
        window.location.href = 'https://www.amazon.com/ap/oa?response_type=code&client_id=amzn1.application-oa2-client.d4e8370b24484d7983257733c3a721c1&scope=profile&redirect_uri=https%3A%2F%2Ffeisty-renewal-production.up.railway.app%2Fauth%2Fcallback&state=rz9bcweseq'
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
