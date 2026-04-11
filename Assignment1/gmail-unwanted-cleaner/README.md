# Gmail Unwanted Cleaner (Chrome Extension)

This Chrome plugin helps you detect, group, and mark unwanted Gmail emails from:

- Inbox
- Promotions
- Spam
- Other category folders

Heres the video of the plugin: https://www.youtube.com/watch?v=UbMfACONxDQ

## Features

- Rule-based detection by:
  - sender domains (for example: `spamdomain.com`)
  - keywords in sender/subject/body preview (for example: `unsubscribe`, `offer`)
- Scan the current Gmail folder and highlight matching emails
- Group results by sender in the popup
- Popup actions:
  - Scan current view and highlight matched emails
  - Mark/select matched emails only
- Badge count on extension icon for matches found

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select this folder: `gmail-unwanted-cleaner`.
5. Open Gmail in a tab.

## How to Use

1. Open Gmail and go to any folder (Inbox, Promotions, Spam, etc.).
2. Click the extension icon.
3. Add keywords and blocked domains.
4. Click **Scan current view**.
5. Review grouped senders in results.
6. Click **Mark only** to only select matched emails.

## Notes

- This extension works on the currently visible Gmail page of emails.
- Gmail UI can change over time; if buttons are not detected, refresh Gmail and retry.
- Best used on list view (where rows of emails are visible).
