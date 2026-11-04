---
title: Cookie Policy
lastUpdated: '2026-11-04'
---

### Table of contents

## 1. What are cookies?

A cookie is a small file that stores information on your device. Your web browser downloads it on the first visit to a website. The next time you open this website with the same device, the cookie and the information stored in it are either:

- sent back to the website that created it (**first-party cookie**), or
- sent to another website it belongs to (**third-party cookie**).

This enables the website to detect that you have opened it previously with this browser and, in some cases, to vary the displayed content.

**Web storage** (local storage and session storage) has similar functionality to cookies. In the following, the term “cookies” refers to **both**, web storage and regular cookies.

**Cookie categories**

There are several categories of cookies including the following cookie categories.

- **Essential cookies**: These cookies are strictly necessary for you to browse a website and use its features.
- **Preference cookies**: Preference cookies are not absolutely necessary for the technical operation of a website but increase user-friendliness.
- **Statistics cookies**: Statistics cookies or performance cookies collect information about how you use a website, e.g., which pages you visited, to improve website functions. The information is aggregated and not used to identify you.
- **Marketing cookies**: Marketing cookies track your activity to deliver relevant advertising or to limit the number of times you see an ad. That information can be shared with other organizations or advertisers.

## 2. How do we use cookies?

On our portal demonstrator we use **strictly necessary (essential)** first party cookies and web storage only. They are needed for you to use the portal's features, which is why no consent is required for them and why you are not asked to agree to anything.

You can find further information about each item in the table below.

| Name                              | Service                 | Purpose                                                                                                                                                                                            | Type and duration                                                                                                                                                        |
| --------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `allowExternalContent`            | market.agrospai.udl.cat | Remembers that you allowed the portal to load content from other websites, such as images embedded in an asset description.                                                                        | First party cookie created if you allow external content. Stored for 60 days, or erased immediately if you return to the default setting: do not allow external content. |
| `approvedTokens_<chainId>`        | market.agrospai.udl.cat | Keeps the list of tokens accepted for payments on the selected network, so it does not have to be loaded again on every page. Contains public information only.                                    | Session storage. Deleted when you close the browser tab.                                                                                                                 |
| `assetView`                       | market.agrospai.udl.cat | Remembers whether you prefer to see assets as a grid of cards or as a list.                                                                                                                        | First party cookie created if you switch away from the default grid view. Stored for 60 days, or erased immediately if you switch back.                                  |
| `bookmarks`                       | market.agrospai.udl.cat | Stores the assets you have bookmarked so you can find them again.                                                                                                                                  | First party cookie created if you bookmark an asset. Stored for one year, or erased immediately if you remove all your bookmarks.                                        |
| `cachedCredentials`               | market.agrospai.udl.cat | Keeps a copy of the verifiable credentials you have presented, so you do not have to present them again for every action.                                                                          | Local storage. Deleted when you disconnect your wallet, log out, or your session expires.                                                                                |
| `chainIds`                        | market.agrospai.udl.cat | Stores which blockchain network(s) you selected, so the portal shows data from those networks.                                                                                                     | First party cookie created if you change the default network selection. Stored for one year, or erased immediately if you return to the default.                         |
| `compute-rerun:<jobId>`           | market.agrospai.udl.cat | Briefly carries the settings of a finished compute job, so the form can be prefilled when you rerun it. Contains public identifiers only.                                                          | Local storage. Written when you select "rerun" and deleted a moment later, once the form has been filled.                                                                |
| `computeOutputEncryption:<jobId>` | market.agrospai.udl.cat | Stores the key needed to decrypt the results of your own compute job, so you can open them later.                                                                                                  | Local storage. Kept until you clear your browser storage. Without it, encrypted results can no longer be opened.                                                         |
| `credential_<assetId>`            | market.agrospai.udl.cat | Stores the time of a successful credential check, so the portal can show how long that check stays valid. It does not grant access by itself.                                                      | Local storage. Saved while you interact with an asset and deleted once the check is no longer valid.                                                                     |
| `credentialSelectionStorage`      | market.agrospai.udl.cat | Remembers which of your credentials you chose during a credential check.                                                                                                                           | Local storage. Deleted when you disconnect your wallet or log out.                                                                                                       |
| `debug`                           | market.agrospai.udl.cat | Remembers that you switched on debug mode, which shows additional technical information.                                                                                                           | First party cookie created if you activate debug mode. Stored for 60 days, or erased immediately if you deactivate it.                                                   |
| `jsonWallet:chainId`              | market.agrospai.udl.cat | Remembers which network you selected for a wallet you imported from a file.                                                                                                                        | Session storage. Deleted when you disconnect or close the browser tab.                                                                                                   |
| `jsonWallet:encryptedJson`        | market.agrospai.udl.cat | Stores a wallet file you imported, in the same encrypted form in which you supplied it, so you can unlock it again without uploading the file each time. It can only be opened with your password. | Local storage. Kept until you remove the stored wallet in the wallet menu.                                                                                               |
| `jsonWallet:pk`                   | market.agrospai.udl.cat | Holds the unlocked key of an imported wallet while you are working with it, so the portal can sign your transactions.                                                                              | Session storage. Deleted when you disconnect or close the browser tab.                                                                                                   |
| `onboardingModule`                | market.agrospai.udl.cat | Remembers whether you hid or re-enabled the onboarding guide.                                                                                                                                      | First party cookie created if you change the default setting. Stored for 60 days, or erased immediately if you return to the default.                                    |
| `onboardingStep`                  | market.agrospai.udl.cat | Remembers how far you got in the onboarding guide, so you can continue where you left off.                                                                                                         | First party cookie created once you move past the first step. Stored for 60 days, or erased immediately when you are back at the first step.                             |
| `sessionToken`                    | market.agrospai.udl.cat | Stores the session token issued after you connect your SSI wallet, so you stay signed in to it.                                                                                                    | Local storage. Stored until the token expires, or until you disconnect or log out.                                                                                       |
| `ssiWalletApiOverride`            | market.agrospai.udl.cat | Stores an SSI wallet address you entered by hand, so the portal uses that one instead of the default.                                                                                              | Session storage. Deleted when you close the browser tab.                                                                                                                 |
| `verifierSessionId`               | market.agrospai.udl.cat | Stores confirmation that you passed a credential check, so you can download or start a job without verifying again.                                                                                | Local storage. Each entry is kept for at most one day, and all entries are deleted when you disconnect or log out.                                                       |
| `wagmi.io.metamask.disconnected`  | wagmi.sh                | Remembers that you disconnected MetaMask, so the portal does not reconnect automatically.                                                                                                          | Local storage. Kept until you connect again or clear your browser storage.                                                                                               |
| `wagmi.recentConnectorId`         | wagmi.sh                | Remembers which wallet you last connected with, for example MetaMask or an imported wallet file, so the portal can offer to reconnect.                                                             | Local storage. Written when you connect a wallet and kept until you clear your browser storage.                                                                          |
| `wagmi.store`                     | wagmi.sh                | Remembers your wallet connection, including the connected account and network, so the connection survives a page reload.                                                                           | Local storage. Created as soon as the portal loads, updated when you connect or disconnect a wallet, and kept until you clear your browser storage.                      |

&nbsp;
For reach analysis we use an **aggregated statistics** tool which does not use cookies, does not track individual visitors and does not create persistent identifiers. Further information about the **aggregated statistics** can be found in our [**privacy policy**](/privacy/privacy-policy).

## 3. How to block or delete cookies

**Removing cookies from your device**

You can delete all cookies or site-specific cookies from your computer's hard disk at any time in your browser settings. For more details, please check the privacy or cookie settings in your preferred browser.

**Blocking cookies**

Most browsers have settings you can use to prevent cookies from being placed on your device. For more details, please check the privacy or cookie settings in your preferred browser. These settings may result in some websites not displaying content or functioning correctly.

## 4. Changes to this cookie policy

This cookie policy will be amended from time to time. You can see the date of the last alteration at the top of this cookie policy. If we make any material changes to our use of cookies, we will notify you by prominently posting a notice on the portal demonstrator.
