# **Specifications**

## **How will you use this application?**
Users will use the application by either logging into the web app or loading the Chrome extension while browsing Amazon. On the web app, they can select categories to view deal comparisons. On the extension, they can check for cheaper alternatives to the product they're currently viewing and save deals directly to their account

## **Where would the user be located physically when using this application?**
Most users will likely be at home, in an office, or anywhere they normally do product research for reselling. Since it’s a web app and a browser extension, it can be used from any device with internet access

## **Where would the results be visible?**
Results are shown directly on the FBAlgo website (dashboard, product finder, saved products) and in the Chrome extension sidebar while on Amazon product pages

## **When will this application be used?**
It will mainly be used when users are sourcing products for reselling, comparing prices, or trying to find profitable arbitrage opportunities. This could be daily or whenever users are researching new inventory to buy

## **When can the application fail?**
Some main reasons the app can fail are:
- External websites change their HTML structure (scraper breaks)
- The Amazon page doesn’t load or doesn’t contain expected data
- The backend service (Node or Python) goes down
- MongoDB connection fails
- User enters invalid login/signup info
- Network connection issues occur on the user’s side
- The Chrome extension doesn’t detect the Amazon page correctly
## **Who is my user?**
The main users are Amazon resellers, online arbitrage sellers, or anyone buying items from one retailer to resell on Amazon for a profit. They could be beginners or experienced sellers

## **Who will deliver the inputs for the application?**
The inputs can come from users (search categories, login info, saving deals), the Chrome extension (ASIN of current product page), or the backend scraping system (product data from other websites)

## **Who will receive the outputs of the application?**
Outputs are received by the user (deal comparisons, saved product info, ROI, prices), the user's account/dashboard, and the Chrome extension popup

## **What do I know about this application?**
This application is designed to make product sourcing easier for resellers by automatically comparing Amazon prices with other retailers. It uses a combination of a React frontend, Node.js backend, FastAPI Python service, and MongoDB database. It’s meant to save time and improve decision-making

## **What does this application need to do?**
The application needs to:
- Allow users to create accounts and log in
- Let users connect their Amazon FBA data
- Allow category-based product searches
- Compare Amazon products against cheaper alternatives
- Display ROI, match score, price difference, and product details
- Allow users to save deals
- Sync saved items between the Chrome extension and web app
- Store all user data securely

## **What are the components of this application?**
- Frontend (React): UI, dashboards, saved products, authentication
- Chrome Extension: on-page deal finder for Amazon
- Node.js Backend: API routing, auth, database operations
- Python FastAPI Backend: scraping, data processing, matching logic
- MongoDB Database: users, saved deals, cached categories
- External Retail Sites: data sources for cheaper product matches

## **What needs to happen next?**
- Continue refining deal accuracy and match scoring
- Add export functionality to Saved Products
- Improve UI responsiveness and error handling
- Possibly expand the number of supported retailers
- Test extension detection on more Amazon product variations

## **What must happen before the next step?**
- Ensure all backend endpoints are stable
- Make sure database schemas are finalized
- Confirm extension authentication works reliably
- Validate category scraping consistency

## **What needs to be tracked?**
Things that need to be tracked include user login status and session, saved product data per user, category deal searches, deal match performance (ROI, scores, retailer data), API call failures (SerpAPI) or scraper errors, and extension usage events (Possible analytics)