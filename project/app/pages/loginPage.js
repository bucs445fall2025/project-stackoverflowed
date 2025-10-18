/*
    Page for the user to enter their FBAlgo credentials in order to access their dashboard
*/
export default function LoginPage() {
    return(
        <div>            
            <h1>Please enter username and password (Hello from loginPage.js)</h1>
            <h5>This is where the user will login to their FBAlgo account in order to access their dashboard</h5>
        </div>
    );
}

/*
FBAlgo Login Flow

Frontend steps:
	1.	Landing page → Login page
	    •	From index.js, user clicks “Log In” → navigates to /login.
	
    2.	Enter credentials
        •	User enters username + password.
    	•	Send POST request to backend route like /api/users/login.
	
    3.	Backend checks credentials
        •	Look up user by username/email.
        •	Compare password with stored hash.
        •	If match → return session token or JWT to frontend.
        
	4.	Restore Amazon link
        •	Backend should still have the user’s amazon_refresh_token stored.
        •	On login, your backend can:
        •	Use that token to get a new access token from Amazon automatically (since access tokens expire quickly).
        •	Update amazon_access_token + token_expiry in the DB.
            This way, the user doesn’t have to re-link Amazon every time they log in.
	
    5.	Redirect to Dashboard
	    •	Once authenticated and Amazon token refreshed, frontend routes user to /dashboard.

*/