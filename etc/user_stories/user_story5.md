# [Automate resale process] 

## **User Story**
As a user,
I want to be able to run the Chrome extension on any Amazon product page so I can instantly check if the same item is cheaper on other websites

---

## **Acceptance Criteria**
- Success means the extension detects when the user is on an Amazon product page
- When the user clicks “Find Deals,” the extension must search external websites for cheaper alternatives
- The extension must show deal results directly inside the popup or sidebar UI
- The user must be able to save a deal from the extension, and it should appear in their Saved Products on the main website
- The extension must be able to authenticate the user (via token or session) to save items

---

## **Notes**
- Must ensure the extension correctly identifies the Amazon ASIN or product title
- Need reliable communication between extension,Node backend, and Python service
- UI should be simple with clear buttons (e.g., “Find Deals,” “Save Deal”)
- Saved deal should immediately sync with the user’s account in MongoDB 