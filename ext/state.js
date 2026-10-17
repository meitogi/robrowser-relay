// The relay's state, as the game page and the popup see it:
// - `off`: switched off in the popup (whether or not a folder is stored);
// - `nogrf`: on, but no client folder stored yet;
// - `ready`: on, with a client folder.
const relayState = (enabled, hasGrf) => (!enabled ? 'off' : hasGrf ? 'ready' : 'nogrf');
