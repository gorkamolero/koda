# Dependency patches

`xterm@5.3.0.patch` fixes a viewport callback left pending when a terminal is
disposed during workspace navigation. `Viewport.dispose()` cancels its refresh
frame; immediate refresh cancels the previous frame before clearing its handle;
the initial size-sync timeout and reset callback ignore a disposed viewport.
This keeps cleanup inside xterm and leaves desktop code on its public API.

The patch includes the shipped TypeScript source, runtime bundle, and source map.
The latter two are single-line upstream files, so the patch is large despite the
small code change. Updating the source map preserves debugging locations after
the inserted code shifts bundle columns and TypeScript lines.

Run `pnpm --filter e2e test:terminal` to exercise the real browser terminal through
public `open`, `write`, `reset`, and `dispose` calls. The frame scheduler makes the
navigation race deterministic. The unpatched package fails with a renderer
`dimensions` exception; the patched package cancels the refresh and safely drains
other delayed callbacks. Recheck this test when upgrading or removing the patch.
