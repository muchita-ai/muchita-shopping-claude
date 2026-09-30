# Muchita Shopping for Claude Code

Ask Claude for the best price on an exact product. The plugin runs a Muchita Shopping check in your own Chrome: it searches stores in your shopping country, verifies the product, variant, availability and item price, and returns the verified offers to your conversation.

## Requirements

Claude Code, Node.js 18 or later and desktop Chrome on the same computer. The check uses the free [Muchita Shopping extension](https://chromewebstore.google.com/detail/muchita-shopping/kdfhenbdndhjcenmjnbnllenhacpaaok), which the plugin offers on first use. No Muchita account or API key is needed.

This plugin is for Claude users, who must be 18 or older under Anthropic's terms.

## Install

From a clone of this repository, run in your terminal:

```sh
claude plugin marketplace add ./
claude plugin install muchita-shopping@muchita --scope user
```

Restart Claude Code, or run `/reload-plugins` in an open session.

## Use

Ask Claude in your own words, or run `/muchita-shopping:check-price <product name or link>`. For example:

- "Find the best price for Sony WH-1000XM5 in black."
- "Is there a cheaper offer for this exact product?" with a retailer product link.
- "Explain this Muchita result, including shipping and anything not verified."

Automatic checks need Claude Code on a computer with Chrome. In claude.ai chat, in Cowork and on phones the local tool does not run; there Claude answers with its usual tools, says those prices are not verified by Muchita, and can give you a link to compare offers you enter yourself.

## One-time Chrome setup

The plugin opens your product check in Chrome. If Muchita is missing, that page says Claude needs it: click Install Muchita from the Chrome Web Store, then Add to Chrome and confirm Chrome's permissions. Keep the original tab open; the same check starts by itself.

## What to expect

Chrome opens a Muchita page for your product. The first time, that page asks you to install the extension; after that the check starts at once. It visibly opens store pages in Chrome for about 1-3 minutes and can be stopped there. A store or search human check may need one click from you. Claude then shows the verified offers, ranked by item price, with shipping shown separately.

Muchita is free and currently has no ads, sponsored placements or affiliate links; offer links are the stores' own listing links. Muchita never buys for you and does not promise the lowest price everywhere.

## Troubleshooting

- Claude does not offer a check: run `claude plugin list`, confirm muchita-shopping is enabled, then restart Claude Code. Check `node --version` shows 18 or later.
- Chrome opened but the check did not start: finish the installation on that page and keep the original tab open. A request that waits more than ten minutes ends; ask Claude again.
- Chrome opened in a profile without Muchita: add Muchita there, or set `MUCHITA_CHROME_PROFILE` to the profile folder name (for example `Profile 1`) before starting Claude Code.
- Chrome did not open: Claude shows a link; open it in Chrome on this computer.
- The check pauses for a human check: complete it in the Muchita tab and the check continues by itself.

## What runs on your computer

The tool is a small local MCP server with no dependencies. It installs no packages and makes no network requests of its own; the Chrome extension does the browsing. During a check it:

- listens only on 127.0.0.1, with a one-time token per check, so the extension can return the result
- opens Chrome at the Muchita check page for your product
- writes a debug log only if you set MUCHITA_TRACE to a file path

## Privacy

The product name or link is passed to the Muchita page in a link fragment, which is not sent in the HTTP request. Your conversation is not sent to Muchita. Retailer browsing runs in your Chrome, and the shopping result returns to Claude. The website and extension follow their own consent rules.

[Privacy](https://shopping.muchita.ai/shopping/privacy) - [Terms](https://shopping.muchita.ai/shopping/terms)

## Support

Email support@muchita.ai with your extension version and what happened. Do not send passwords, payment details or a private check link.

MIT licensed. Muchita is independent of Anthropic.
