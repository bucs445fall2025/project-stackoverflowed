import LoginButton from '../components/loginButton';
import SignUpButton from '../components/signUpButton';

/*  
    Public-facing home page
    This is what Next.js renders when user visits '/'
*/
export default function Home() {

    return(
        <div>
            <h1>Welcome to FBAlgo (Hello from index.js)</h1>
            <h2>
                The overall purpose of the application is to provide a web-based tool 
                for Amazon FBA resellers that helps them make smarter decisions about their business. 
                The application will connect with a reseller’s FBA account and display relevant product 
                and account information in an easy-to-use dashboard. By providing actionable insights, 
                the tool aims to save resellers time and help them increase profitability
            </h2>
            <h3>Landing page for the site, gives info about the site for first time visitors</h3>

            <SignUpButton />
            <LoginButton />
        </div>
    );
}

