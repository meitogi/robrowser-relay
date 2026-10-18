// Chrome has no `browser` namespace; its `chrome.*` returns promises in MV3, so the same calls work.
globalThis.browser ??= chrome;
