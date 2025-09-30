# **Project Overview**

## **Application Vision/Goal:**
The overall purpose of the application is to provide a web-based tool for Amazon FBA resellers that helps them make smarter decisions about their business. The application will connect with a reseller’s FBA account and display relevant product and account information in an easy-to-use dashboard. By providing actionable insights, the tool aims to save resellers time and help them increase profitability

## **Scope:**
The scope of the project includes building a web application with a dynamice frontend UI using React and a Node.js backend that integrates with Amazon’s FBA API. The system will allow users to view product statistics such as best sellers, competitor counts, and pricing data, as well as account-specific information like inventory levels and listing performance. These statistics will then be used to make calculations in the backend, and based on the calculations we will give insights to the user displayed on the frontend. While advanced features such as automated pricing adjustments based on our calculations may be considered, the initial focus will be on providing a functional dashboard with accurate insights

## **Deliverables:**
The main deliverable will be a working MVP that lets users log in with their Amazon FBA account and view key data on their listings and competitors. Users will also be able to customize which information is emphasized, such as focusing on certain categories or product types. Additional deliverables include backend calculations with clear documentation on how recommendations are made, with the option to adapt calculations based on user preferences. A database may be introduced to store product, pricing, and sales data to reduce repeated API calls and improve performance. Stretch goals include automating listing updates on Amazon FBA based on our recommendations, as well as providing full project documentation, setup instructions, and an explanation of the system architecture and technology stack

## **Success Criteria:**
Success criteria of this project would include meeting deadlines for implementing the core functionality of the project, like allowing FBA users to log in, and displaying accurate data from their accounts. We would also consider this project sucessful if our insights/calculations that we provide actually benefit the FBA user in terms of profitability. Additionally, another long term success point of this project would be that our site can handle multiple users if it ever grows. Overall we will measure the sucess of our project based on the features that the application can provide, and implementing these features on a timely basis

## **Assumptions:**
We assume that the Amazon FBA API will provide access to the necessary data for both product listings and account information. In the case that some information is missing, we may have to use other 3rd party API's and/or webscrape specific information. It is also assumed that users will already have an Amazon FBA account to connect to our application, and if not we will provide some redirect for them to create an account first

## **Risks:**
[Identify potential risks and challenges, such as technical limitations, resource constraints, or dependency issues.]
One risk is potential limitations of the Amazon FBA API, such as rate limits, types of data it provides, or changes in the API access of it. If Amazon makes some unexpected changes to this API, it may affect our website negatively. Another risk is the integration of the multiple technologies we plan on using, which may introduce compatibility or performance issues if not managed properly. Time and resource constraints are also risks, especially if we try to implement our advanced features like automation of updating the users FBA account, adjusting calculations for recomendations based on user input, etc

## **Design / Architectural Review:**
The application will follow a client-server architecture, with React handling the frontend and Node.js managing the backend. For the initial implementation, the system will be built as a monolithic application just to keep development simpler. A MongoDB database may be included to cache or store user-specific product data, such as listings, sales history, or pricing information, reducing the need for repeated API calls. Overall the major components of the architecture will include the React frontend (UI/UX), the Node.js backend (API and business logic), optional MongoDB database (data storage), and the Amazon FBA API (external data source)

## **Test Environment:**
[Define how the application will be tested. Will you use automated tests? What environment will the tests run in?]
Our current plan for testing the application is to either find mock data that mimmic the FBA API responses, or to utilizie Sam's friends FBA account, which already has some listings, sales etc. From there, we can use this data to test how it is displayed on our frontend, and what type of calculations can be made with it. Still need to finalize testing methods, however once we have more of an established product it should be easier to decide

---

# **Team Setup**

## **Team Members:**
Nicholas DeNobrega, Jackson Searles, Samuel Buckler

## **Team Roles:**
Currently, all three team members will work as full-stack contributors, assisting with both frontend and backend tasks. Since none of us have significantly more experience with React or Node.js than the others, we believe collaborating and discussing solutions together will be the most effective approach. That said, Samuel may take a stronger role in testing, as he has access to an Amazon FBA reseller account through a friend, which can be used for real-world validation. If a database is needed, Nicholas may focus more on that area since he has prior experience working with SQL and PostgreSQL. Jackson will provide additional support across both areas, contributing wherever needed to balance the workload


## **Team Norms:**
Team meetings will ideally be in person outside and in class. When meeting outside of class, main meeting location will be in the computer lab of Bartle library. When communication is needed outside of in-person meetings, communication will happen through the group Discord server that all team members are a part of. Ideally, the team will meet once or twice a week in person to discuss primary points of interest that week, with any follow-up questions/concerns handled on Discord

## **Application Stack:**
Technologies used in the project, such as programming languages, will mainly consist of JavaScript/TypeScript, since we plan on using a combination of React and NodeJS for the frontend and backend. Python may be included for some backend computations if needed (TBD), depending on how well it integrates into the project. This also goes for possibly integrating a database, most likely MongoDB. Since we believe we may use Python and a database through MongoDB, we chose to include them in the application stack. Finally, we will need to utilize Amazon’s FBA API to pull information useful for our website

### **Libraries/Frameworks:**
Specific libraries/frameworks we currently believe our application will use would be React and NodeJS, with more to be added if needed