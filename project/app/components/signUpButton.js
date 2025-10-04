import { useRouter } from 'next/router'; // "router hook" lets you navigate between pages

export default function SignUpButton() {
    const router = useRouter();

    const handleClick = () => {
        // Reroute to the signUpPage
        router.push('/signUpPage');
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
                fontFamily: 'Arial, sans-serif',
            }}
        >
            Sign Up
        </button>
    );
}