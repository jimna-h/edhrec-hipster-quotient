# EDH Hipster Quotient

**Live app:** https://jimna-h.github.io/edhrec-hipster-quotient/

Type in your Commander decks' leaders and get a verdict on how mainstream your
taste is — from *Certified Mainstream* to *Insufferable Hipster* — based on each
commander's live popularity rank on [EDHREC](https://edhrec.com).

Single-file vanilla JS. No frameworks, no build step, no dependencies.

## How it works

EDHREC has no public API, so the app extracts rank data directly from each
commander's own page:

1. **Autocomplete** is powered by the [Scryfall API](https://scryfall.com/docs/api)
   (`order=edhrec`), so suggestions surface real commanders as you type.
2. **Name → slug normalization** converts a card name into EDHREC's URL slug.
   This is the fiddly part: EDHREC slugs by front face only for double-faced
   cards, strips accents, and *deletes* (rather than hyphenates) all
   punctuation — including oddities like the modifier-letter colon in
   "Ratonhnhaké꞉ton".
3. **Rank extraction** fetches `edhrec.com/commanders/{slug}` and parses the
   embedded `__NEXT_DATA__` JSON payload for the exact rank, deck count, mana
   value, and color identity. This deliberately avoids EDHREC's internal
   Next.js data routes, whose build ID rotates on every deploy and would break
   silently. The payload shape was verified against commanders ranked from
   #86 to #2,711.
4. **Partner pairs and DFCs** are disambiguated by card id: a partner pair
   lists two distinct ids, while a single double-faced commander lists one id
   twice (once per face), which is deduped so the mana curve doesn't
   double-count.

Commanders can also be handed over in the link, which fills the slots and checks them right away:
`#c=Commander&c=Partner+One|Partner+Two` (one `c` per deck, `|` between partners).
[Archidekt Snapshot](https://jimna-h.github.io/archidekt-snapshot/) uses this to send over every
commander in your folder.

**Copy list** on the score card copies the checked results to the clipboard, one
line per deck, ready to paste into Discord or a forum post:

```
* Atraxa, Praetors' Voice — 1,674 — 1,252 decks
* Tymna the Weaver/Thrasios, Triton Hero — 287 — 9,621 decks
```

Requests are throttled (one at a time, out of politeness), cached per slug,
and wrapped in a 10-second abort timeout so one bad lookup can't hang a batch.
Entered decks persist across visits via localStorage.

## The score

The headline Hipster Quotient is a weighted blend of the **median** and
**mean** of your commanders' ranks, at 4:1. Median keeps one deep cut from
blowing up the score; the dash of mean makes sure the deep cut still leaves a
mark. Alongside the score, the app renders a color-identity breakdown and
combined commander mana curve for the whole roster.

## Running locally

It's one HTML file — open `index.html` in a browser, or serve the folder with
any static file server.
