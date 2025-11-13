# Sprint Meeting Notes

*note: replace anything surrounded by << >> and **remove** the << >>*

**Attended**: Jackson, Samuel, Nicholas

**DATE**: 2/11/25

***

## Sprint 8 Review

### SRS Sections Updated

Requirements section (FRs and NFRs)

### User Story

Worked towards User Story 1

### Sprint Requirements Attempted

"Need product comparison functionality"

### Completed Requirements

Implemented functionality that allows the user to compare the prices of products scraped from Walmart against the same product scraped from Amazon. Updated the Dashboard to improve UX. Also worked further towards getting the app verified for SP-API so we can use production mode. 

### Incomplete Requirements

N/A

### The summary of the entire project

We have a landing page, signup and login system with a MongoDB database. Users can create an FBAlgo account and log in to the site to visit a dashboard page. We two backends, a node.js/express backend and a python backend for computation and webscraping using serpAPI. The python backened enables pulling Walmart product data for price comparison against Amazon listings. The project remains a web-based tool for Amazon FBA resellers, providing a dashboard of account/product info and actionable insights to help users increase profitability.

***

## Sprint 8 Planning

## Requirements Flex

5/5 requirement flexes remaining

## Technical Debt

N/A

### Requirement Target

Need requirement checking on account credentials during creation

### User Stories

User story 4

### Planning

The plan is to implement credential verification functionality on the account creation page. We need to make sure user names and emails are unique, and that passwords meet a minimum length requirement, and have at least one special character and number.

### Action Items

This verification logic needs to be implemented within the create account creation page

### Issues and Risks

There should be no issues or risks with this requirement

### Team Work Assignments

Jackson will implement the verification logic in the account creation page, and research account recovery functionality
Sam will continue to look into getting the app verified for SP-API so we can use production mode
Nick will look into how to make the webscraping more efficient so we require less SerpAPI requests to populate the database