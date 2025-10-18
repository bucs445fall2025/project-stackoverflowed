export default function Dashboard(){
    - Displays users FBA account data after having been analyzed
}

export default function SignUpPage(){
    - User enters their desired username and password
    - These are checked against the database for  redundancy and checked for complexity requirements
    - If valid, they are entered into the database
    - User links their Amazon FBA account to their FBAlgo account credentials
    - They are redirected to the dashboard page
}

export default function LoginPage(){
    - User enteres their FBAlgo account credentials
    - If they are valid, route the user to the dashboard       
}