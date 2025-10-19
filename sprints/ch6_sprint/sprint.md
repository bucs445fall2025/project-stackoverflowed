# Sprint Meeting Notes

*note: replace anything surrounded by << >> and **remove** the << >>*

**Attended**: Nicholas DeNobrega, Jackson Searles, Samuel Buckler

**DATE**: 10/19/25

***

## Sprint 6 Review

### SRS Sections Updated

Requirements section (FRs and NFRs)
Testing

### User Story

Worked towards and completed User Story 4

### Sprint Requirements Attempted

- Successfully host database on Railway
- Be able to create an FBAlgo account
- Be able to log in to site with FBAlgo account

### Completed Requirements

We successfuly hosted MongoDB on Railway, allowing us to store user FBAlgo account credentials. Created a form on signUpPage.js that allows the user to enter their desired account credentials. These credentials are then routed to the back-end at 
/api/users/register. If the credentials are satisfactory, the new account is created and placed into the database. We also put a form on loginPage.js in which the user can enter their credentials in order to access their dashboard page. The account credentials are routed to /api/users/login, where they are verified, and if they are satisfactory, the route returns 200/OK to the loginPage.js, which then routes the user to the dashboard page.

### Incomplete Requirements

N/A

### The summary of the entire project

Currently, we have a landing page. When the user clicks Sign Up, they are taken to the account creation page, where they can create their FBAlgo account. From the landing page, when the user clicks the rocketship, the user is taken to the log in page, where they can enter their FBAlgo credentials to access their dashboard. On the dashboard, the user is greeted, and can click the Link FBA Account button, which launches a pop up window for the user to link their FBA account to their FBAlgo account.

A summary of our project is that its a web-based tool for Amazon FBA resellers that helps them make smarter decisions about their business. The application will connect with a reseller’s FBA account and display relevant product and account information in an easy-to-use dashboard. By providing actionable insights, the tool aims to save resellers time and help them increase profitability

***

## Sprint 7 Planning

## Requirements Flex

5/5 requirement flexes remaining

## Technical Debt

N/A

### Requirement Target

Implement requirement checking on the password entered by the user on account creation. Check for minimum length, whether or not it has a special character, whether or not it has a number, and show how "strong" it is.

### User Stories

user_story4 is the closest to our current goal, we have account creation completed, but this is a feature we should add to help make things more secure and feel more official.

### Planning

The plan is to check for requirements on the password entered by the user during account creation. We should also be able to make progress on unrelated things as well.

### Action Items

We need to password strength verification. We still need to decide whether or not we will implement 2 factor authentication.

### Issues and Risks

N/A

### Team Work Assignments

Nick will work on improving on and documenting our current implementation
Jackson will implement the requirement checking on the password
Sam will work on more UX/front end design