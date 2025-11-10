# Sprint Meeting Notes

*note: replace anything surrounded by << >> and **remove** the << >>*

**Attended**: Samuel, Nicholas, Jackson

**DATE**: 11-9-2025

***

## Sprint 9 Review

### SRS Sections Updated

Section 2: Functional requirements (FRs and NFRs)

### User Story
User Story 1 and User Story 4

### Sprint Requirements Attempted
Implement the verification logic in the account creation page, and research account recovery functionality
Continue to look into getting the app verified for SP-API so we can use production mode
Look into how to make the webscraping more efficient so we require less SerpAPI requests to populate the database

### Completed Requirements
Continue to look into getting the app verified for SP-API so we can use production mode
Look into how to make the webscraping more efficient so we require less SerpAPI requests to populate the database

### Incomplete Requirements
Implement the verification logic in the account creation page, and research account recovery functionality

### The summary of the entire project
We have a landing page, signup and login system with a MongoDB database. Users can create an FBAlgo account and log in to the site to visit a dashboard page. We two backends, a node.js/express backend and a python backend for computation and webscraping using serpAPI. The python backened enables pulling Walmart product data for price comparison against Amazon listings. We have a dashboard that displays product comparisons based on category between Walmart and Amazon such that the Walmart items are cheaper. The dashboard will also display specific FBA data for a seller. The project remains a web-based tool for Amazon FBA resellers, providing a dashboard of account/product info and actionable insights to help users increase profitability.

***

## Sprint 10 Planning

## Requirements Flex

4/5 requirement flexes remaining

## Technical Debt
Implement the verification logic in the account creation page, and research account recovery functionality

### Requirement Target
Implement a feature for product matching that uses an opposite flow of what we have now. 
Update UI to have tabs at the top that bring you to different pages, one for seller data, one for product comparisons, etc.
Implement an AI chatbot somewhere in the site to give user's informed AI advice

### User Stories
User story 1 

### Planning
To implement this new ingestion feature, we need to use O(#pages) serpAPI calls to ingest Amazon data based on a category given by the user. We should store this data in a sluggified amz_category collection. Then on the python backend, sift through this data, and see if its "sellable". This involves checking to see if it needs brand approval, and if so what type of brand approval. We also should check information like price history volatility and number of competitors, which we should research what API to use to do this. Then we should look to see if we can find the product anywhere cheaper. 
To update the UI, we are going to need to create separate pages rather than having a single dashboard page. If we figure out a better way to redesign the UI to organize everything, thats fine too.
To implement an AI chatbot, we need to implement the OpenAI API into a dashboard page. When the user says something, we should send GPT info about the seller so that it has context. 

### Action Items
Backend: Implement OpenAI API
Backend: Implement a third party product research API
Backend: Implement new routes for Amazon/scrape and maybe an Internet/search for a product search
Frontend: Create new page files for each component now if thats the design we want to go with

### Issues and Risks
A risk would be not being able to find an API that can do this for us affordably. Also, the OpenAI chatbot might be slow and underwhelming.

### Team Work Assignments
Jackson will handle UI and work on OpenAI API
Nicholas will handle new Python backend routes for the new Amazon ingestion format
Samuel will assist with new Amazon ingestion format and work on OpenAI API