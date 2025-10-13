# Sprint Meeting Notes

*note: replace anything surrounded by << >> and **remove** the << >>*

**Attended**: Nicholas DeNobrega, Jackson Searles, Samuel Buckler

**DATE**: 10/13/25

***

## Sprint 5 Review

### SRS Sections Updated

Requirements section (FRs and NFRs)
Software Architecture Diagram: 
    https://lucid.app/lucidchart/b59e6ca2-b53b-4a36-ba86-b968a6a200e0/edit?invitationId=inv_b1c8b1b7-1341-429a-88e3-fff1d0a1b48d

### User Story

Worked towards story 2, to be able to see users product information on the dashboard. We're much closer now, but not completely finished with it.

### Sprint Requirements Attempted

Access data from users Amazon account

### Completed Requirements

Gained access to the users FBA account product information through Amazon's Selling Partner-API (SP-API). Created a back-end route to fetch product listings from users FBA account, then sends the data to a React component, which is used on the dashboard page to display the users data.

### Incomplete Requirements

We were not able to finish the Software Architecture Diagram in time. We began working on it, but it remains uncompleted

### The summary of the entire project

Currently have:
Currently, we have a login page on our end. When the user clicks login, we utilize the Amazon LWA API to redirect the user to login with their Amazon account. Once the API verifies its an authentic amazon account, the user is then routed back to our "dashboard" page. The users products are crudely displayed on their dashboard. 

Entire Project:
A summary of our project is that its a web-based tool for Amazon FBA resellers that helps them make smarter decisions about their business. The application will connect with a reseller’s FBA account and display relevant product and account information in an easy-to-use dashboard. By providing actionable insights, the tool aims to save resellers time and help them increase profitability

***

## Sprint 6 Planning

## Requirements Flex

5/5 requirement flexes remaining

## Technical Debt

N/A

### Requirement Target

Make account creation page. Does not need to be fully functional, but will be used later on by the user to create an FBAlgo account by entering in at least a username and password. This will allow them to link their FBA account to their FBAlgo account. This page will be the jumping off point for the account creation functionality that we'll be implementing later on.

### User Stories

user_story2 is the closest to our current goal, which is for the user to be able to see how their products are doing and display info from their Amazon account on the dashboard page

### Planning

The plan is to make the account creation page and research the logistics of the account creation process. We should also be able to make some progress on the back-end side of things. 

### Action Items

We need to create the front end page. We need to do more research on the account creation process, and whether or not 2 factor authentication is necessary

### Issues and Risks

We should be able to complete the sprint, but we should keep security risks in mind when dealing with user credentials. We need to make sure we're being responsible with users information.

### Team Work Assignments

Nick will create the front end page
Jackson will look in to the logistics of storing user credentials in the MongoDB database along with their Amazon tokens
Sam will look in to the logistics of 2 factor authentication and if we should implement it