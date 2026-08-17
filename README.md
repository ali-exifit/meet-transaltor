Meet Caption Translator — Popup size control

You can control the popup translation box size from the extension's popup settings.

- Open the extension popup (toolbar) and go to Settings -> Popup Controls.
- Set `Popup Size` value and choose unit:
  - `vw` — viewport width (recommended, keeps it proportional to window)
  - `px` — fixed pixels
  - `%` — percent of the container (less commonly used)

The extension provides separate controls for Popup Width and Popup Height. Each accepts a numeric value and unit (vw/px/%). The popup will use those values (width and height independently). Long translations will scroll inside the fixed box.

If you want a different shape or separate width/height controls, open an issue or request and I can add them.
