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
Implement serpAPI, a 3rd party API that can be used to scrape Walmart for certain products, the prices associated with these products and more. This info will be used to compare to amazon products to see if there are cheaper products listed on Walmart compared to Amazon counterpart

### User Stories
User_story1 would be the closest to this requirement goal, since this is related to having a dashboard with important stats such as best selling products, etc. This would contribute to that goal of knowing what product can be beneficial to buy since there is a price difference where it can be purchased somewhere else for cheaper

### Planning
The plan is to research serpAPI, which seems to be a good 3rd party API for this goal. We plan on researching the documentation on what type of data can be pulled, how to call API etc. Since this is a python API, we have to setup some sort of python service in our backend to use this API.

### Action Items
We need to implement some sort of python API in backend that can interact with current backend
We need to research into how to use serpAPI and how to set it up

### Issues and Risks

N/A

### Team Work Assignments

Nick will work on implementing some sort of Python backend that integrates with our current backend
Jackson will research into the possibilities of using serpAPI, such as what data can be pulled, what sites it works on etc
Sam will work on more UX/front end design of how the data will be displayed