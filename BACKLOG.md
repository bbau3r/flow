# Backlog

Work for later, written so someone new to the project can pick up any item. Each one gets its own branch, which is merged to `main` and deleted when done.

Start with the README. Storage options are providers in `packages/pwa/src/providers/`, and `providers/index.js` describes the interface. `google-drive.js` on the shelved branch is the closest example.

## Storage providers

The owner isn't sure Flow should support cloud storage at all, so check with them before starting anything here.

### Google Drive (shelved)

Written and tested against stand-ins, and shelved on the `feat/google-drive-folders` branch before a real sign-in was completed. Google's real sign-in page opened with no setup errors, but the picker and saving were never tried with a real account. Saving into a picked folder under the `drive.file` permission is the part most in need of a real test.

Local credentials live in `packages/pwa/.env.local`, which Git ignores. The branch's README has the setup steps.

### Add Proton Drive

Let people open and save scripts in Proton Drive, like Google Drive: sign in, then choose a file or folder.

**Check this first.** In November 2026, Proton's [Drive SDK](https://github.com/ProtonDriveApps/sdk) wasn't ready for this:

- Its README said it wasn't ready for third-party production use. Personal, non-commercial projects were allowed.
- It left out sign-in and session handling, so a third party would have to build them and handle Proton credentials and keys.
- A change to its encryption model was targeted for late 2026 or early 2027, after which older SDK releases stop working with new data until upgraded.
- Apps must identify themselves honestly in `x-pm-appversion`, use only official domains, and avoid Proton's branding. Others can be rate-limited or blocked.

If that still holds, raise it with the project owner before building. It's also unconfirmed whether Proton's servers accept requests from a web page, which could rule out a browser-only version. Proton Drive also has no known "Open with" or plugin system.

**In the meantime:** Proton's desktop app syncs a local folder, so "This device" already reaches Proton Drive on desktop.

### Add OneDrive

Let people open and save scripts in OneDrive, like Google Drive: sign in, then choose a file or folder.

**Expected approach, to confirm against Microsoft's current docs:** sign in with MSAL.js, choose with the OneDrive File Picker, and read and write through Microsoft Graph, with the narrowest permission available. It needs an app registration in Microsoft Entra, with the site's origin as a redirect URI. As with Google, the identifiers are public and should come in at build time.

**Done when:** it follows the provider interface, shows "Needs setup" without credentials, has tests in `packages/pwa/e2e/pwa.spec.js`, has setup steps in the README, and has been run against a real Microsoft account.

## Product

### Show title page field labels

Labels such as `Copyright:` stay hidden until the cursor is on the line, so a new script shows values with no hint of which field is which. The owner wants to decide this later, probably alongside the UI work below.

### Refine the UI from mockups

Build a design document with the owner and refine the UI against it. Open Pencil is preferred if its files can live in this repository without needing Git LFS, so check the file format and sizes first. Figma is the alternative.

### Open `.fountain` files from the operating system

Register a file handler in the web app manifest so that an installed Flow can open `.fountain` files directly.

## Quality

### Make typing faster on long scripts

Typing costs about 2.5 ms per key on a short script and about 85 ms at 113 pages on a desktop, so phones will feel it. Parsing takes only about 10 ms, and layout already waits for a pause, so most of the time goes to ProseMirror's view update. Measure before changing anything.

### Test in Firefox and Safari

Automated tests only run in Chromium browsers, and CI installs only Chromium. Safari matters most, because iPhones and iPads need it for the PWA. Add both as Playwright projects and fix what fails.

### Make the ribbon compact on phones

The ribbon takes up about five rows on a phone. Keep the PDF menu usable if it becomes scrollable, because a scrolling container would clip the dropdown.

### Test the "new version" banner

Nothing yet tests the prompt that appears when a new version of the PWA is ready.
