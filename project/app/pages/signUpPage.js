import LinkAccountButton from '../components/linkAccountButton';

/* 
    Page for the user to create their FBAlgo account.
    Credentials from this page will be put into the database.
    Their Login With Amazon refresh token will be linked to this account.
*/
export default function SignUp() {

    // something here to gather FBAlgo account creds
    // need a way to utilize linkAccountButton.js once they've created their FBAlgo account
    // Thisll probably be a little involved
    return(
        <div>
            <h1>Please create username and password (Hello from signUpPage.js)</h1>
            <h5>This is where the user will create their FBAlgo account</h5>
            
            <h5>This button is here for testing purposes \/ for Sprint due October 6th</h5>
            <LinkAccountButton/>
        </div>
    );
}