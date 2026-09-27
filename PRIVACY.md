# TubeLens — Privacy Policy

**Last updated:** 2026-09-26

TubeLens is a Chrome extension that shows similar YouTube channels on channel pages. This policy describes what data the extension handles.

## Data the extension stores

- **Your YouTube Data API key.** Stored only in `chrome.storage.local` on your own device. It is never synced to your Google account, never sent to us (there is no "us" — there is no server), and never transmitted anywhere except `https://www.googleapis.com` when you run a lookup.
- **Lookup results cache.** Channel IDs, titles, thumbnails, subscriber/view counts, and the overlap badges from your lookups are cached in `chrome.storage.local` for 7 days (200-entry LRU cap), so revisiting a channel costs zero API quota. The cache never leaves your device.

## Data the extension sends

- **YouTube Data API requests.** When you visit a channel page (or press refresh), the extension calls the YouTube Data API v3 with *your* API key to fetch public video/channel metadata. These requests go directly from your browser to Google under your key and your quota. See Google's privacy policy for how Google handles API traffic.

## Data the extension does NOT collect

- No analytics, no telemetry, no crash reporting.
- No account creation, no email, no personal information.
- No browsing history is recorded or transmitted. The extension reads the current tab's URL only to detect YouTube channel pages.
- There is no backend server. There is nowhere for your data to go.

## Your control

- Delete the API key on the options page at any time; lookups stop immediately.
- Clearing the extension's storage (`chrome.storage.local`) wipes the key and the entire cache.
- Uninstalling the extension removes everything.

## Contact

Open an issue at https://github.com/dtyutyunik/tubelens/issues.
