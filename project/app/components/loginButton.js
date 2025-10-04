import { useRouter } from 'next/router'; // "router hook" lets you to navigate between pages

export default function LoginButton() {
    const router = useRouter();

    const handleClick = () => {
        // Reroute to the loginPage
        router.push('/loginPage');
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
            Log In
        </button>
    );
}