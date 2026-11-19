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
| Changing parameters in the card | Ask "run SIGPAC with clip-raster" without giving parameters. In the card, press "Edit parameters" under the algorithm and under the dataset, change a number, a list and a switch, press "Done" and run it. Also empty a required field. | The card first lists the values that will be sent (defaults or the ones given in the chat). The job runs with the changed values: check `algoCustomData.json` in the job's logs or results. An empty or invalid required value is marked on its field and the job cannot run. After starting, the values show without "Edit parameters". |
| Opening an HTML report from the chat | Run SIGPAC → clip-raster from the chat. When it finishes, press "Open the report" and sign, then open "Open report.html". Also press "Ask about the results": the link appears under your message too. | The report opens in a new tab with its Leaflet map working. It cannot reach the market: it runs in a sandbox with an opaque origin. After reloading the market the links are gone: read the results again from a new card, or download them from your compute jobs. |
| Talking about a job's results | Run "Enhanced Exploratory Data Analysis" on "Red Wine Dataset" from the chat. When it finishes, press "Ask about the results" on the card and sign. Then ask a follow-up, such as "are there duplicate rows?". Repeat with SIGPAC → clip-raster, and with a job that fails. | One signature, then the assistant summarizes the report (rows, variables, alerts, correlations) and answers the follow-up from it. For a failed job it explains the log. Asking "how did the results go?" without the button points to the card's button. |

**New panel UI: checklist.**
- An "AI Assistant" button appears in the header once the wallet is connected and the chat is configured, except on the home page, where the assistant is the page itself. On the first visit, a note under it says what the assistant can do, until it is opened or dismissed.
- On the home page, an "AI Assistant" badge, a line on what it does and a sparkle in the message box tell it apart from the search field the home page used to have.
- Without a session (no wallet, or a wallet that has not signed in), the home page's assistant can only search: the server offers the model only `search_assets`, with its own prompt, and a note in the message box offers "Connect wallet" or "Sign in". The conversation is kept in the tab only (sessionStorage), goes on as the wallet's once signed in, and does not follow to other pages. `CHAT_ANONYMOUS_RATE_LIMIT_PER_MINUTE` (default 5 per network address, 0 turns it off) limits it. The address is the first `X-Forwarded-For` entry: the proxy must overwrite that header, or a client can forge it to get around the limit.
- The welcome leads with actions (search, buy and download, Compute-to-Data), and each page's suggestions include at least one action, not only questions.
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

## Thinking and jobs asked for by their result (2026-11-13)

"dame los indices ndvi a partir de las imagenes satelite para la parcela de provincia 7 municipio 10 poligono 5 parcela 12 y recinto 25" ended in "The model returned no answer.". The model reasons by default (the reasoning arrives in `delta.reasoning`, which the chat does not show), and with it the question took one round more than the six allowed: the last round has no tools, and the model wanted to call `prepare_compute_job` in it.

What changed:
- `CHAT_LLM_THINKING` (`on` or `off`, default off): off sends `chat_template_kwargs: { enable_thinking: false }`.
- `MAX_ROUNDS` is 10. Before the last round the model is told that it has no more tool calls (`FINAL_ROUND_NOTE`), and an empty answer there shows its own message.
- The prompt says how to turn a wanted result into a job: search the algorithm, `get_compatible_datasets`, prepare.
- A tool call with arguments that are not JSON is sent back to the model with `{}`: the model server answers HTTP 400 to the conversation otherwise.
- `agrospai-on-mcp` (branch `feat/goal-driven-jobs`, not pushed): the compatibility tools list the parameters of the assets, so `get_asset` is not needed before preparing; parameter errors list every parameter; the recipe is in the tool descriptions.

Measured with `node --env-file=.env scripts/chat-llm-bench.mjs` (Node 22): 8 questions, 2 repetitions each, `Qwen/Qwen3.8-27b`, one request at a time.

| | Before, thinking on | Before, thinking off | After, thinking on | After, thinking off |
| --- | --- | --- | --- | --- |
| Passed | 14/16 | 16/16 | 13/16 | 16/16 |
| Median time | 60.7 s | 39.4 s | 44.8 s | 35.3 s |
| Longest | 132.4 s | 69.3 s | 78.9 s | 61.9 s |
| Mean tool calls | 4.1 | 4.3 | 2.6 | 3.1 |
| Reached the last round | 2 | 3 | 0 | 0 |

- The NDVI question: before, it failed with thinking (116–132 s) and passed without (53–69 s, 8 tool calls, in the last round but one). After, it passes in both (62–72 s with, 51–56 s without, 3–4 tool calls).
- The three failures after, all with thinking on: "ejecuta el dataset sigpac contra el algoritmo clip-raster" twice asks for the parcel instead of preparing the job with the default values, because the new prompt says to ask for a value only the user knows; and one request got the HTTP 400 above, before that fix.
- Not measured: `FINAL_ROUND_NOTE` with the real model, since no run reached the last round after the changes. It is covered by unit tests only.

Open: if thinking is ever turned on, narrow the prompt so it only asks for the parcel when the user names neither the dataset nor the algorithm.

## Context budget (2026-11-17)

The chat used to send the last 20 messages, however short or long. It now sends the newest messages that fit in `CHAT_MAX_CONTEXT_CHARS` (48,000 characters, `src/@types/Chat.ts`), with the latest job results counted in. The browser picks them (`planContext` in `src/@hooks/useChat.ts`), and `/api/chat` refuses a request over the budget or over 200 messages.

What the model reads in one call of a request:

| Part | Size | Bounded by |
| --- | --- | --- |
| System prompt | fixed | `SYSTEM_PROMPT` |
| Tool definitions | fixed, rendered into the prompt by Qwen's chat template | the MCP tools in `_tools.ts` |
| Conversation and latest job results | up to 48,000 characters, about 12–14k tokens | `CHAT_MAX_CONTEXT_CHARS` (results alone: 20,000) |
| Tool calls and results of this request | grows each round: up to 5 results of 16,000 characters per round, 10 rounds | `MAX_TOOL_CALLS_PER_ROUND`, `MAX_TOOL_RESULT_CHARS`, `MAX_ROUNDS` |
| The answer | what the model writes | `ANSWER_RESERVE_TOKENS` (3,000) |

The last row is the only one that can grow without bound. So the chat asks vLLM for the exact count of each call (`stream_options: { include_usage: true }`). With `CHAT_LLM_CONTEXT_TOKENS` set, once the next call would leave less than 3,000 tokens free, it gets no tools and has to answer: it estimates the new tool results at 3 characters a token.

The user sees it in the panel header: a ring with the share of the budget the next message takes. It is full and amber once older messages are left out, and a line in the conversation marks where. Its tooltip gives the tokens of the last answer, and the window when it is set.

### Measuring it

- **The window.** `curl -H "Authorization: Bearer $KEY" http://<vllm>:8000/v1/models` gives `max_model_len`. Set `CHAT_LLM_CONTEXT_TOKENS` to it.
- **The fixed part.** `node --env-file=.env scripts/chat-llm-bench.mjs --scenarios <a short question> --reps 1 --thinking off` prints the tokens of each question. Its first call is the system prompt, the tool definitions and the question, so it is close to the fixed part. Run all scenarios to see how far real questions go.
- **Exactly, before sending.** vLLM's own `POST /tokenize` takes `{ "model", "messages", "tools" }` and returns `count` and `max_model_len`, applying the same chat template. It is on vLLM, not on Open WebUI.
- **In use.** The ring's tooltip, from the `usage` event of each request.

### Sizing the window on one L40 (48 GB)

vLLM fills the memory left after the weights with KV cache, and `--max-model-len` must fit in it. At startup it logs `GPU KV cache size: N tokens` and `Maximum concurrency for <max-model-len> tokens per request: X`: that is the number to trust.

- **Weights.** 27B parameters are about 54 GB in BF16: they do not fit. In FP8 they are about 27 GB, in 4-bit AWQ or GPTQ about 15 GB.
- **KV cache per token.** 2 × layers × KV heads × head dim × bytes per value, from the model's `config.json` (`num_hidden_layers`, `num_key_value_heads`, `head_dim`). For example, 64 layers, 8 KV heads and head dim 128 in BF16 are 256 KiB a token, and half with `--kv-cache-dtype fp8`. If the model mixes in linear-attention layers, only the full-attention ones count: trust the log.
- **What is left.** About 48 GB × `--gpu-memory-utilization` (0.9 by default), minus the weights, minus 2–4 GB of activations and CUDA graphs. In the example, FP8 weights leave about 12 GB: some 48k tokens of cache in BF16, or 96k with an FP8 cache, shared by every request at the same time.

A 32k window holds the fixed part, a full conversation budget and about 10k tokens of tool results. With a larger window, raise `CHAT_MAX_CONTEXT_CHARS` so conversations last longer. Leave room for the requests that run at once: the chat allows one per wallet.

Not measured yet: the fixed part and the largest request with the real model, and whether Open WebUI passes `usage` through when it streams. Without it the ring still works, but its tooltip has no tokens and the window guard is off.

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
- **Job status for the model:** an MCP tool, so the model can answer "how are my jobs going?". For now, the card polls the status itself. In user mode it could read the status with the session's address, since the status needs no signature. The results still need the user's signature: the browser reads them when the user presses "Ask about the results" (`src/@utils/chat/jobResults.ts`) and sends them with the question.
- **OIDC:** when OIDC is enabled, the chat session could also require the OIDC session. To be confirmed before implementing.

## Known limits (by design)

- **Orders bought for a free-environment job.** The node does not check them, as in the compute wizard. The publisher is paid anyway.
- **A job that fails after paying.** Its orders stay valid until their timeout, so "Try again" does not pay them again. A deposit stays in the escrow and can be withdrawn from the profile.
- **Job results go through the browser.** The node gives a job's results only to its owner, with a fresh signature. The MCP in user mode has no key, so the user signs once on the card, and the browser reads the outputs, keeps their text and sends it with the question. HTML reports are reduced to their text for the model. They also open from a link on the card and under the message: the link is a `blob:` URL made in the browser, whose page shows the report in an `<iframe sandbox="allow-scripts allow-popups">`, as the MCP serves them. It lasts until the market page is reloaded. It works because the market sets no CSP: a CSP added later, for example by a proxy, would also apply to the report and could block its scripts, such as Leaflet from unpkg. At most 20,000 characters are sent, smallest files first, and only the latest results go with each request.
- **Spending cap.** Without `NEXT_PUBLIC_CHAT_MAX_SPEND`, the chat only runs free actions. With it, the total of each action (orders plus the job's cost) must not exceed it.
