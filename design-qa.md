# Design QA

## Landing móvil y carga de video — 2026-07-28

Target: Pteron landing, responsive mobile correction and video loading state

Reference: `IMG_3104.PNG` and `IMG_3105.PNG` captured on the user's iPhone

Verification viewport: 393 × 852 px

### Reference findings

- Mobile display type was oversized: the headline, supporting copy, button, and note consumed too much vertical space.
- Safari displayed the scroll-film area as an almost solid black field while the MP4 was not ready to provide a seeked frame.
- `product-home-current.png` contained a large black canvas around the application window. Scaling that complete canvas made the actual product unnecessarily small.
- The scroll-film negative margins expanded the mobile stage beyond the viewport.

### Corrections verified

- Reduced and rebalanced the complete mobile type scale and spacing without changing the selected copy.
- Kept the full application window and removed only the black canvas outside it. All four rounded application edges remain visible.
- Added a full-page loading state that keeps the page hidden until the MP4 is decoded and seekable.
- Adapted the supplied medusa animation to a canvas loader using Pteron's paper, ink, and gold palette. It contains no text or visible container.
- Loads the MP4 into a local Blob before revealing the page, improving reliable seeking in iOS Safari. The poster remains as the failure fallback.
- Preloaded the poster and product image, and added intrinsic image dimensions to prevent layout shifts.
- Corrected mobile film margins. Final product-image bounds at 393 px viewport: left 16 px, right 377 px, width 361 px.
- Horizontal overflow: 0 px.
- Verified ready state after loading: loader dismissed, video class active, `readyState: 4`, Blob source active, video opacity `1`.
- Browser console: 0 errors, 0 warnings.

### Visual result

- Hero capture: `.playwright-cli/page-2026-07-28T12-53-03-014Z.png`
- Film and complete product capture: `.playwright-cli/page-2026-07-28T12-56-45-227Z.png`
- Loader capture: `.playwright-cli/loader-pteron-mobile-final.png`
- Page after video readiness: `.playwright-cli/pteron-mobile-ready-final.png`

Final result: passed

## Documentación — 2026-07-28

- source visual truth: `/Users/marcorojasbelmar/.codex/generated_images/019fa715-a99f-76e0-84af-c5e3241b485c/call_qj1xVIphMTzt8PX01cmexIp3.png`
- implementation: `http://127.0.0.1:4173/docs/`
- implementation screenshot: `/Users/marcorojasbelmar/Developer/pteron-landing/output/docs-windows-desktop.png`
- paired comparison: `/Users/marcorojasbelmar/Developer/pteron-landing/.playwright-cli/page-2026-07-28T19-49-20-422Z.png`
- viewport: 1440 × 1024 CSS px
- source pixels: 1487 × 1058
- implementation pixels: 1440 × 1024
- device scale factor: 1
- normalization: both full-page designs were displayed at equal CSS width in the paired comparison; their aspect ratios differ by less than 0.1%.
- state: Windows installation article, light theme, top of page

## Findings

No actionable P0, P1 or P2 findings remain.

- Fonts and typography: the selected concept used an editorial serif throughout the article. Per the approved direction, the implementation intentionally limits Newsreader to the single header wordmark and uses DM Sans for the documentation UI and article hierarchy. This is a controlled deviation that makes the result more technical and prevents repetition of the pteron display treatment.
- Spacing and layout rhythm: the three-column reading structure, sticky search, sidebar grouping, restrained borders and above-the-fold installation sequence match the source hierarchy. The implementation is slightly denser and uses fewer decorative elements.
- Colors and tokens: ivory paper, navy ink, muted blue, sand warning and ochre section labels map to the reference and the existing pteron palette. Contrast remains clear on the warning and navigation states.
- Image quality: the real 2242 × 1540 product capture is rendered at its native aspect ratio with `height: auto`; all four application edges remain visible. No screenshot crop, black placeholder or generated replacement is used.
- Copy and content: the implementation is shorter and more explicit than the concept. It states that Windows 11 is supported in beta, that the installer is unsigned, what SmartScreen may show, and how to verify the official source. It does not promise a stable date.
- Icons: the final implementation does not reproduce the concept’s decorative line icons because the information architecture no longer needs them. No fake SVG, emoji or CSS illustration replaces a required asset.
- Accessibility and behavior: skip link, semantic navigation, labelled search, keyboard shortcut, focus state, responsive menu state/label, reduced-motion support and meaningful image alt text are present.

## Focused region evidence

- Windows warning and numbered steps were inspected at 1440 × 1024 and 390 × 844.
- The complete product capture was inspected at mobile width after scrolling it into view; its borders and corners remain present.
- The version table was inspected at 900 × 800 with no horizontal page overflow.

## Comparison history

### Pass 1 — blocked

- P2: the first implementation separated installation into three long sections, pushing the product capture almost entirely below the 1024 px viewport and drifting from the selected concept’s compact procedural rhythm.
- P2: the 761–1080 px breakpoint hid the global navigation even though there was enough space, reducing discoverability on tablets.
- P2: the mobile menu opened correctly but did not change its control text or accessible label to communicate the close action.

Fixes:

- Replaced the long Windows sequence with a compact five-step list, then moved the detailed verification note below the real product capture.
- Kept the global navigation visible through the tablet breakpoint.
- Added synchronized `Menú`/`Cerrar`, `aria-expanded` and accessible-label states.

### Pass 2 — passed

- Paired source/implementation evidence shows the product capture entering the first viewport, compact steps, matching three-column structure, and the intentional sans-first technical treatment.
- Desktop, tablet and mobile layouts have no horizontal overflow.
- Search, internal route navigation, mobile menu, version-data rendering and the next-page path were exercised.
- Browser console: 0 errors on application routes reached through the SPA navigation.

## Residual P3 polish

- The right-side table of contents could highlight the section currently crossing the reading position; its links already work.
- The search result list could support arrow-key selection in a later accessibility refinement.

final result: passed

## Lanzamiento 0.2.12 y Linux — 2026-08-11

Target: landing, downloads, documentation, plans and terms after adding Linux x86_64 beta support.

Verification viewports: 1440 × 900 px and 390 × 844 px in the collaborative browser against the local HTTP server.

### Corrections verified

- Added Linux as a third platform without naming distributions that were or were not tested.
- Made AppImage the primary Linux download and exposed `.deb`, `.rpm` and `.tar.gz` as alternatives.
- Added the public GPG key, its fingerprint and detached-signature links.
- Added Linux installation and update documentation. Only the AppImage is described as using the internal updater; the package and archive formats use manual updates.
- Kept AUR out of all public copy until that channel exists.
- Reproduced an intermittent stale-cache failure in which current HTML was overwritten by cached JavaScript that still rendered 0.2.10. Versioned changed CSS and JavaScript URLs with `?v=0.2.12`; the download page then consistently rendered 0.2.12.
- Hardened release discovery: bundled data and the public GitHub Releases API are combined using semantic-version ordering, and an update is announced only when the full release asset matrix is present. A local complete fallback keeps the page useful during source failures.
- Rendered remote release notes as text rather than HTML.
- Verified home, downloads, Linux documentation, version history, plans and terms on desktop and mobile.
- No horizontal page overflow was observed. The responsive version table retains its intentional internal horizontal scroller on narrow screens.
- The home and download videos reached `readyState: 4` and played after loading in both tested viewports.
- JavaScript syntax checks passed; `node --test tests/*.test.js` passed 32/32; `git diff --check` passed.

Final result: passed locally. Production verification remains required after deployment.
