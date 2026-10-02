# Brain Rot Blocker

Private Chrome extension. Gates YouTube Kids autoplay behind a short
comprehension challenge about the video just watched.

Not for the Chrome Web Store. One child, one Mac, one Chrome profile.

## Build

```
npm install
npm run build      # produces dist/
npm run watch      # rebuild on change
npm run typecheck
npm test
```

## Install

1. `npm run build`
2. Open `chrome://extensions` on the child's Chrome profile
3. Turn on Developer mode
4. Load unpacked, and pick the `dist/` folder

## Current state: phase 1

Only the provider boundary and the YouTube Kids capture hook exist. There is no
locking, no quiz and no parent PIN yet. The extension currently watches videos
and records what it managed to capture, so transcript availability can be
measured on the real profile before anything is built on top of it.

### Verifying phase 1

Play four or five YouTube Kids videos of different kinds, then open the
extension's options page (Details, then Extension options, on
`chrome://extensions`). It lists every video seen with whether a transcript was
captured, how many cues, whether the captions were human authored or automatic,
and whether the end of the video was detected.

Phase 2 does not start until that page shows transcripts being captured on
`youtubekids.com`. Reference measurement from `youtube.com`: 12 of 20 kids
videos carried English captions, 4 of those human authored.

## Why the hook is shaped the way it is

The signed caption URL inside the player response returns HTTP 200 with an
empty body. Every `/api/timedtext` URL lacking a `pot` proof-of-origin
parameter returned zero bytes, while the request the player issued itself
carried `pot` and returned 17,857 bytes. That token cannot be minted from
outside the player, so the extension asks the player to fetch its own captions
and reads the answer, rather than fetching them directly.

Synthesised `/youtubei/v1/player` calls are also rejected as `UNPLAYABLE` by bot
detection, even from the site's own origin. Nothing here fabricates requests.

## Layout

```
src/config.ts               every tunable, single source
src/providers/types.ts      the provider boundary
src/providers/youtubeKids/  the only code that knows about YouTube Kids
src/background/             service worker, state owner
src/ui/                     quiz surface
src/parent/                 parent panel and recovery surface
```

Core systems consume normalized provider events only. Adding `youtube.com`
later means writing one more module behind `providers/types.ts`.
