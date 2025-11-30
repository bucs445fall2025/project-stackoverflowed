# [Automate resale process] 

## **User Story**
As a user,
I want to be able to save deals that I find on the website or through the Chrome extension so I can easily revisit them later without needing to re-run the search

---

## **Acceptance Criteria**
- Success means the user can click a “Save” or “Favorite” button on any deal
- The saved product must be stored in MongoDB under the user’s account
- The saved product must appear on the “Saved Products” page on the web app
- Saving a deal from the Chrome extension must also sync and appear on the Saved Products page
- Removing a saved product must update the database and UI accordingly
- Saved items should persist across logins

---

## **Notes**
- Must ensure saved product includes all relevant fields (name, price, ROI %, images, links)
- Need API routes for “add saved product,” “get saved products,” and “delete saved product.”
- Must verify the user is authenticated (JWT) before saving
- Chrome extension and web app must both call the same backend endpoints for consistency
- UI should clearly show when an item is already saved (e.g., filled-in icon or disabled button). 