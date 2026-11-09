# Market chat: what is left

**Status on 2026-11-09.** Branch `feat/mcp-chat`.

The core is done and tested for real with the user's wallet on OP Sepolia:
- SIWE sign-in;
- questions about the catalogue;
- free downloads and free jobs;
- the purchase of a 1 devEURAU dataset from its page, with the exchange fix now on `agrospai` (4bcab178, 4fa88e51; see `known-issues/fixed-rate-exchange-address.md`);
- a paid download from the chat: "Valoración de activos agrícolas" (1 devEURAU) was bought and downloaded from the chat;
- a job in the paid environment, with escrow;
- a paid dataset in the free environment.

The escrow also settled. After the paid job, 5 devEURAU were locked. The profile then showed 0 locked and 4 available: the node claimed 1 devEURAU for the job and released the rest.

## Still to test

| What | How to test it | What should happen |
| --- | --- | --- |
| "Try again" reuses orders | Start a paid job, and reject the job-start signature after the orders are confirmed. Then press "Try again". | The bought asset shows "Already bought". The wallet does not ask for the approve or the purchase again. |
| New panel UI | Use the market in the browser (see the checklist below). | It behaves as described in the checklist. |

**New panel UI: checklist.**
- An "AI Assistant" button appears in the header once the wallet is connected and the chat is configured. On the first visit, a note under it says what the assistant can do, until it is opened or dismissed.
- The welcome leads with actions (search, buy and download, Compute-to-Data), and each page's suggestions include at least one action, not only questions. A line says what stays in the portal (publishing, editing, job results).
- On the default panel width the title reads "Assistant", so it does not wrap next to "New chat"; the wider panel shows "AgrospAI Assistant".
- On screens 1200 px or wider, the panel opens at the right and the page makes room for it. On narrower screens, the panel covers the page.
- "Make wider" widens the panel. The page also makes room for the wider panel on screens 1600 px or wider.
- On a phone, the panel fills the screen and the header shows only the icon.
- ⌘/ (Ctrl+/ outside macOS) opens and closes the panel. Escape closes it. The focus goes to the message box when the panel opens. When it closes, the focus goes back to where it was if the panel was opened with the keyboard. If it was opened with the mouse, the focus is released, so the header button keeps no focus ring.
- With no messages, the panel shows suggestions for the page:
  - on an asset page, about that asset, including "Get this asset for me";
  - on the catalogue, a search, a download and a Compute-to-Data job;
  - elsewhere, the same mix with general searches.
- The conversation stays when moving between pages.
- The panel and its button are hidden while publishing (`/publish`).
- "New chat" (in the header, icon only below 400 px) deletes the conversation. "Undo" brings it back until the next message.
- A conversation left more than 12 hours ago is put aside: the panel starts empty and offers "Continue it".
- "Sign out and delete conversation" is in the ⋯ menu.
- While a card is paying or starting a job, "New chat" and "Sign out" are disabled.

## Pending (not chat code)

- **Secrets:**
  - rotate the production MCP token that was shown in a conversation;
  - give the market a non-admin Open WebUI service API key.
- **Optional cleanup:** delete the `[compare-market-chat]` chats in Open WebUI.
- **Review and merge** the chat PR (`feat/mcp-chat` → `agrospai`). The exchange fix, its tests and the compute refactor are already on `agrospai`.
- **Market search ignores words without their accents.** The node's index does not fold accents and the search needs 75 % of the words to match, so "Valoracion de activos agricolas" finds nothing in the market (`src/components/Search/utils.ts`). The MCP already retries an empty search approximately (`agrospai-on-mcp`, `docs/decisions.md` deviation 7), so the chat finds it. The market search is still to fix.
- **Deployment:**
  - an MCP instance with `WALLET_MODE=user`, separate from the shared-wallet one;
  - the chat variables listed in `.env.example`;
  - ETH for the compute node's account, so it can lock and claim escrow payments. Watch its balance.
  - Rate limits and SIWE nonces live in the memory of each process. With several replicas they need a shared store or sticky sessions.
- **MCP session (optional):** tell it that paid downloads exist in the catalogue, so its tests cover them.

## Postponed (decide later)

- **Page context:** an "Ask about this asset" button on asset pages, which opens the panel with that asset as context. It needs the current page passed to the model (`src/pages/api/chat/_loop.ts`). For now, the suggestions on an asset page name its DID in the prompt.
- **Follow-up suggestions** after each answer.
- **Job status for the model:** an MCP tool, so the model can answer "how are my jobs going?". For now, the card polls the status itself.
- **OIDC:** when OIDC is enabled, the chat session could also require the OIDC session. To be confirmed before implementing.

## Known limits (by design)

- **Orders bought for a free-environment job.** The node does not check them, as in the compute wizard. The publisher is paid anyway.
- **A job that fails after paying.** Its orders stay valid until their timeout, so "Try again" does not pay them again. A deposit stays in the escrow and can be withdrawn from the profile.
- **Spending cap.** Without `NEXT_PUBLIC_CHAT_MAX_SPEND`, the chat only runs free actions. With it, the total of each action (orders plus the job's cost) must not exceed it.
