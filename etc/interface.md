# export default function Dashboard(){
- Displays the user’s Amazon FBA account data after backend analysis
- Shows category selector for browsing different product groups
- Sends category requests to Node backend. forwarded to Python FastAPI for scraping and deal analysis
- Renders deal cards comparing Amazon prices vs other retailer prices
- Displays ROI %, price difference, match score, and product links
- Provides navigation bar to Product Finder, Amazon Dashboard, Chat Bot, and Saved pages
- Automatically updates as new deals are fetched or saved
}

# export default function SignUpPage(){
- User enters desired username + password to create an FBAlgo account
- Checks database for username redundancy
- Ensures password meets complexity requirements
- Hashes password before storing in MongoDB
- Creates user document in the database and initializes empty saved-product list
- Redirects user to the Dashboard after successful signup
- Begins initial load of FBA data and recommended deals
}

# export default function LoginPage(){
- User enters their FBAlgo account credentials
- Sends credentials to Node backend for verification
- Backend checks for matching username and hashed password in MongoDB
- Generates JWT/session token for authenticated users
- Redirects valid users to their Dashboard
- Displays error messages for invalid credentials
}

# export default function ProductFinder() {
- User selects a product category (ex: Cleaning Supplies, Electronics)
- Sends selected category to backend
- Backend calls Python FastAPI service for scraping, price comparison, and match scoring
- Displays deal cards showing Amazon product vs cheaper retailer matches
- Shows ROI %, difference, images, and purchase links
- Allows user to save any deal directly to their account
- Retrieves cached deals from database when available for faster load times
}

# export default function SavedProductsPage(){
- Displays all products saved by the user
- Shows Amazon product + matched product side-by-side
- Includes product images, prices, ROI %, difference, and ASIN
- All items retrieved from MongoDB based on user’s unique ID
- Allows deletion/removal of selected saved products
- Includes (soon) export function for CSV/PDF creation
- Syncs with Chrome extension saves in real time

# Chrone Extension Interface
- Detects when user is on an Amazon product page
- Displays sidebar UI when activated
- “Find Deals” button triggers backend search on external retailers
- Uses product title/ASIN to locate cheaper alternatives
- Shows results inside extension with prices, ROI %, and product images
- Allows user to click “Save Deal” to store item in MongoDB
- Authenticates via user’s existing FBAlgo login/JWT
- Syncs saved deals to the main website’s Saved Products page