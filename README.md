# Muchita Shopping for Claude

Real store prices, checked in your own Chrome. Ask Claude for offers for an exact product name and variant, or a public retailer product link. Muchita checks stores in your shopping country and returns verified item prices with shipping shown separately.

## Requirements

Fresh checks require desktop Chrome and the free [Muchita Shopping extension](https://chromewebstore.google.com/detail/muchita-shopping/kdfhenbdndhjcenmjnbnllenhacpaaok). The hosted edition requires Muchita 0.3.22 or later and needs no local server, Node.js installation or terminal setup. No Muchita account or API key is needed.

**Availability:** Chrome Web Store publication of Muchita 0.3.22 is in progress. Earlier Store versions cannot run hosted Claude checks. The complete flow has been verified in Claude web using the 0.3.22 release candidate.

You must meet Anthropic's applicable age and account requirements for the Claude service you use. Consumer accounts require age 18 or the higher local minimum.

## Connect

Enable Muchita Shopping in a Claude client that supports remote MCP plugins. For a custom connector test, use this server URL:

`https://shopping-plugin.muchita.ai/mcp/claude`

No authentication is required. If your Claude client supports interactive MCP Apps, offers also appear in a live card. In clients without cards, Claude retrieves and explains the result with the connected tools. This repository does not claim directory publication or approval.

For Claude Code, install the same hosted plugin from a clone of this repository:

```sh
claude plugin marketplace add ./
claude plugin install muchita-shopping@muchita --scope user
```

Restart Claude Code, or run `/reload-plugins` in an open session. Ask Claude in your own words, or run `/muchita-shopping:check-price <product name or link>`.

## Your first check

1. Ask for an exact product, such as "Find offers for Sony WH-1000XM5 in black."
2. Open the private check link Claude shows in desktop Chrome. The hosted connection cannot launch Chrome itself.
3. If Muchita is missing, click Install Muchita, then Add to Chrome in the Web Store and confirm Chrome's permissions. Keep the original check tab open; the same check starts automatically after installation.
4. Chrome visibly checks stores, usually for 1-3 minutes. You can keep working or stop the check in Chrome. A human check may need your attention.
5. Verified offers update in the live card when supported, even after Claude stops replying. Claude can retrieve the same completed check without starting another hunt. Open an offer to buy directly from the retailer.

Offers are ranked by verified item price. Shipping is free, a stated extra charge, or not confirmed; unknown shipping is never treated as free and shipping does not change the item-price order. Prices and availability can change. Results cover the offers Muchita could verify, not every offer on the internet. Muchita never buys for you or handles payments. The service is free and currently has no ads, sponsored placements or affiliate links.

## Phones and unavailable tools

A phone cannot run a fresh check. Keep the product for a later desktop Chrome check, or ask Claude to explain an existing Muchita result. If the connected tools are unavailable, Claude can answer with its usual tools and makes clear those prices are not verified by Muchita. Manually entered prices are not a substitute for a Muchita hunt.

## Troubleshooting

- No Muchita tools: enable the plugin or connector in this conversation. In Claude Code, check `claude plugin list` and restart or reload plugins.
- The check waits after installation: return to the original check tab and use the Chrome profile where Muchita is installed. An unopened request expires after ten minutes; ask for a fresh check if it expired.
- Chrome needs a human check: complete it in the Muchita tab; the same check continues.
- The result did not appear: ask Claude to retrieve the existing check. Keep its private link private; it grants access to that check.

## Privacy

The hosted MCP connection temporarily processes only your chosen product name or public link, optional shopping country and check result. Stored check data is deleted within one hour. No conversation, budget, name, address or payment details are requested or sent to Muchita. The extension reads search and retailer pages in your own Chrome. The result returns to Claude through the connected tools. Website and extension analytics follow their existing consent rules.

[Privacy](https://shopping.muchita.ai/shopping/privacy) - [Terms](https://shopping.muchita.ai/shopping/terms)

## Support

Email support@muchita.ai with your extension version and what happened. Do not send passwords, payment details or a private check link.

[Setup and support](https://shopping.muchita.ai/claude/) - [Documentation](https://github.com/muchita-ai/muchita-shopping-claude#readme)

MIT licensed. Muchita is independent of Anthropic.
