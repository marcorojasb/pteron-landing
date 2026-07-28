# Design QA

Date: 2026-07-28

Target: Pteron landing, responsive mobile correction and video loading state

Reference: `IMG_3104.PNG` and `IMG_3105.PNG` captured on the user's iPhone

Verification viewport: 393 × 852 px

## Reference findings

- Mobile display type was oversized: the headline, supporting copy, button, and note consumed too much vertical space.
- Safari displayed the scroll-film area as an almost solid black field while the MP4 was not ready to provide a seeked frame.
- `product-home-current.png` contained a large black canvas around the application window. Scaling that complete canvas made the actual product unnecessarily small.
- The scroll-film negative margins expanded the mobile stage beyond the viewport.

## Corrections verified

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

## Visual result

- Hero capture: `.playwright-cli/page-2026-07-28T12-53-03-014Z.png`
- Film and complete product capture: `.playwright-cli/page-2026-07-28T12-56-45-227Z.png`
- Loader capture: `.playwright-cli/loader-pteron-mobile-final.png`
- Page after video readiness: `.playwright-cli/pteron-mobile-ready-final.png`

Final result: passed
