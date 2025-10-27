# Sprint Meeting Notes

*note: replace anything surrounded by << >> and **remove** the << >>*

**Attended**: Samuel, Nicholas, Jackson

**DATE**: 10/27/2025

***

## Sprint 7 Review

### SRS Sections Updated

Requirements section (updated FRs for API data handling)
Added new user interface section

### User Story

Worked towards User Story 1 (dashboard with important product statistics)

### Sprint Requirements Attempted

Begin integration of serpAPI with backend
Research serpAPI functionality, supported data, and request/response handling
Initial setup of a Python-based service in backend for API calls

### Completed Requirements

Researched serpAPI documentation and confirmed it can pull Walmart product listings and associated prices
Created a prototype Python service that can call serpAPI and return raw data in commandline
Established basic backend route for testing serpAPI responses

### Incomplete Requirements

N/A

### The summary of the entire project

Currently, we have a functioning landing page, signup and login system with MongoDB support, and a dashboard for logged-in users. Users can create and log in with an FBAlgo account. We have started backend development for integrating serpAPI so the system can pull Walmart product data for price comparison against Amazon listings. The project remains a web-based tool for Amazon FBA resellers, providing a dashboard of account/product info and actionable insights to help users increase profitability.


## Sprint << num >> Planning

## Requirements Flex

<<5>>/5 requirement flexes remaining

## Technical Debt

N/A

### Requirement Target

Structure serpAPI results into usable data for dashboard display
    This involves setting some some prototype algorithm for product comparison
Begin frontend design of the comparison feature
Begin SP-API app verification for PRODUCTION MODE apps instead of sandbox so we can add redirect URI's

### User Stories

User Story 1 (dashboard with key product information, including cheaper Walmart product comparisons)

### Planning

Implement logic to parse serpAPI response JSON and structure into product objects
Begin frontend design to display Walmart vs. Amazon comparison results on dashboard
We also need to do research and come up with a more robust way to compare Walmart products versus Amazon products. We should look into parsing UDP numbers, and sending those to Amazon. Another thing to keep in mind is reducing serpAPI calls (or searches) because these are expensive $$. This means for each walmart product, if we have to search it up on Amazon, that is lots of calls.
    Getting SP-API into production mode may resolve this issue


### Action Items

Backend: Parse and clean serpAPI response data in a robust and repeatable manner
Backend: Call serpAPI on Amazon's website, reliably find product matches
Frontend: display product comparisons with price differences
Begin identity verificaition in the Solution Provider Portal with Amazon

### Issues and Risks

SerpAPI is very costly to use, and it may end up taking many calls to actually find a product comparison. Also, finding an exact product match between walmart and amazon is difficult to do even by hand, so having a program that automates this may be difficult or not reliable/accurate

### Team Work Assignments

Jackson will handle researching ways to reliably find product matches using UDP number, and implementing this logic in the backend
Samuel will work on verifying SP-API app for production mode, and working on refining the backend logic to minimize serpAPI calls, ensure clean database interactions (cleans according to an If-Modified tag potentially)
Nicholas will work on designing and implementing the user interface for on the dahsboard which will display product comparisons as well as the product image, and link to the product on both walmart and amazon