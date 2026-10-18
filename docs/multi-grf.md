# Idea — several client folders, picked per server

Status: idea, not started. Wanted once the relay serves more than one server.

## Goal

Keep several client folders in the extension (an old pre-renewal client, a recent renewal one…) and give each
game page the one that fits its server: chosen once per server, proposed automatically, with a warning when
the folder does not match.

## What the page knows, and what it does not

- The page knows its server before it asks for the files: roBrowser's config holds, per server, `packetver`
  (`20211103` for cyro.live), `renewal` and the display name. `LoginEngine` refuses to start without a
  `packetver`.
- The game server never says it. rAthena is built with a fixed `PACKETVER` and no packet carries it; the
  login packet's `version` field (the config's `version: 55`) is checked by rAthena when
  `check_client_version` is on, never sent back.
- roBrowser's only detection is a fallback: when the character list does not split into blocks of the
  expected size, it guesses the block size among known ones. It does not detect a packet version.

## Sketch

1. **Page contract**: `{ roRelay: 'want-files' }` grows the server's facts:
   `{ roRelay: 'want-files', server: 'cyro.live', packetver: 20211103, renewal: false }`. Old pages send
   none; the relay then answers with the default folder, as today.
2. **Several folders**, each with a name ("cyro 2021", "renewal 2025"…) and the folder picked per server,
   remembered.
3. **Dating a folder**: a GRF holds no packet version, but its files date it — files that only exist from
   some year on, renewal-only data, the names of the `System/*.lub` tables. The relay proposes the folder
   whose date fits the page's `packetver` / `renewal`.
4. **Warnings** before **Play**: the folder looks renewal while the server is pre-renewal, or older than the
   server's `packetver`.

Changes both sides of the contract (the sites' `relay-client.js` / landing and the extension) and needs a new
extension version. Design it once for Firefox and the Chrome port, so both speak the same contract.
