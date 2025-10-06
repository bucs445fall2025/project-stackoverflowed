# Sprint Meeting Notes

_note: replace anything surrounded by << >> and **remove** the << >>_

**Attended**: Nicholas DeNobrega, Jackson Searles, Samuel Buckler

**DATE**: 10/6/25

---

## Sprint Review

### SRS Sections Updated

Updated the Functional requirement section from last sprint, specifically the LWA authentication one

### User Story

ALligns with User_story2 in terms of about the user being able to see there products and how there being sold etc.
Even though this user story has not been fully completed, the feature we completed is a part of it, i.e authenticating login
with Amazons LWA API, so that in the future the user will be able to seee their top products, competitors etc.

### Sprint Requirements Attempted

Attempted and completed the "LWA-API Authentication" requirement listed in the second section called Functional Requirements

### Completed Requirements

In this sprint, we focused on implementing the Login with Amazon (LWA) API to enable Amazon account authentication on our site. To start, we set up an account on Amazon’s Developer Console to obtain our CLIENT_ID and CLIENT_SECRET. These credentials allow our application to use the LWA API to verify user logins securely. To generate these keys, we needed to have our site hosted publicly, since Amazon requires a public privacy policy page to be linked to the developer account. Once that was set up, we created a new backend route in our Express.js server that handles the login requests from the frontend. On the frontend, we implemented a simple login button with a click handler that calls this backend route when pressed, completing the login flow

### Incomplete Requirements

Currently only authenticates the users login with the Amazon LWA API. However to get actual data from the users Amazon FBA account, there is a separate API key called SP-API (Amazons Selling Partner API). This will be our next requirement, since we want to start building our frontend dashboard however we don't know what specific data we will get yet.

### The summary of the entire project

Summary of entire project or summary of what we currently have??

What we currently have:
Currently, we have a login page on our end. When the user clicks login, we utilize the Amazon LWA API to redirect the user to login with their Amazon account. Once the API verifies its an authentic amazon account, the user is then routed back to our "dashboard" page. Currently no statistics or data is displayed, however in the future this is where it will go.

Entire Project:
A summary of our project is that its a web-based tool for Amazon FBA resellers that helps them make smarter decisions about their business. The application will connect with a reseller’s FBA account and display relevant product and account information in an easy-to-use dashboard. By providing actionable insights, the tool aims to save resellers time and help them increase profitability

---

## Sprint Planning

## Requirements Flex

3/3 requirement flexes remaining

## Technical Debt

No requriements from previous sprint are using technical flex

### Requirement Target

The corresponding SRS requirement we want to implement is 2B (SP-API Authentication). This is the requirement to setup the API associated with the FBA account to actually pull some data from FBA

### User Stories

This requirement is also most closely associated with user_story2, which is for the user to be able to see how their products are doing, so in order to do that we need to have the api to pull their products and make some recomendations etc.

### Planning

Our current plan is to research what requirements are needed to actually access this SP-API key (obviously an Amazon FBA account). However not sure if there is any additional things , such as maybe the account needs to be of some age, have some x amount of sales, etc. Once we determine the requirements of being able to use the API, we will integrate it with our Node.JS backend

### Action Items

Meet at some point this week, maybe tomorrow or wednesday
Determine what are requirements of using the SP-API
Maybe research what type of data we can access with the API
Integrate with NodeJS backend
Obtain an FBA account to do some testing, even if the account doesn't have any products etc we can at least use it to test our code

### Issues and Risks

A potential obstacle is that there could be some restrictions or requirements for the FBA account to use this SP-API, since were assuming not just any old account can use. So there could be some restriction that hinders us. Also we dont know what EXACT data we can obtain with this API, just that it is the API associated wtih the FBA accounts.

### Team Work Assignments

Nick will work on researching the background information on what requirements are needed to use this API, then begin contributing to integrating the API to the backend
Samuel will work on possibly obtaining an FBA account (since his friend has one already) that can be used to test. Then begin contributing to integrating the API to the backend
Jackson will try to research what possible typesof data can be accessed through the API, then begin contributing to integrating the API to the backend
