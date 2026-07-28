# Pteron landing — Design QA

## Reference

- Selected direction: `/Users/marcorojasbelmar/.codex/generated_images/019fa715-a99f-76e0-84af-c5e3241b485c/call_s9XBA5pe9wTTj8kiRKxapqcu.png`
- Additional motion source: `/Users/marcorojasbelmar/Downloads/14556-258207702_medium.mp4`
- Reference dimensions: 1536 × 1067 px
- Reference state: desktop, top of landing page

## Implementation

- Local route: `http://127.0.0.1:4173/`
- Desktop QA viewport: 1440 × 1000 px
- Mobile QA viewport: 390 × 844 px
- Desktop capture: `output/implementation-final.png`
- Side-by-side comparison: `output/design-comparison.png`

## Comparison history

1. Matched the selected editorial direction: ivory ground, navy serif hierarchy, restrained gold accents, compact navigation, manifesto copy and paired actions.
2. Replaced the static product preview immediately below the hero with the user-provided atmospheric video.
3. Implemented a 240vh scroll scene with a 100vh sticky viewport. Scroll progress maps linearly to the full 22.23-second video.
4. Fixed the hero overflow rule so the sticky scene remains pinned rather than leaving a black remainder.
5. Verified the midpoint at 50% scroll: video time 11.09 seconds, sticky top 0 px.
6. Verified mobile at 390 × 844 px: no horizontal overflow, full-height scene, intentional vertical crop.
7. Verified browser console: 0 errors, 0 warnings.
8. Added a continuous transition in which the assistant interface rises over the film during its final scroll segment. At 72% progress it enters from the lower edge on both desktop and mobile.

## Intentional differences

- The selected mock used a product screenshot below the hero. The final implementation uses the supplied cloud-and-water film in that position, as explicitly requested.
- The implementation headline is slightly larger at the QA viewport to preserve the stronger typographic scale already approved during iteration.

## Result

passed

## Synthesis iteration

- Reduced the story to three moments: teaching load, human judgment, and access.
- Kept the promise deliberately narrow: preparing and reviewing materials.
- Added the origin statement: “Construido por profesores, para profesores”.
- Replaced the earlier product capture with the complete user-provided application screenshot. It is rendered at its original aspect ratio without cropping, zooming, or internal repositioning.
- Removed the false white extension below the application. Its cause was CSS Grid stretching the figure beyond the intrinsic image height; the figure now shrink-wraps the image and keeps a transparent background.
- Desktop renders the complete screenshot at 88% of the content width so all four application edges fit inside the sticky viewport. Mobile uses the full available width. Neither breakpoint crops the image.
- Final geometry check: the figure and image have identical bounds (1140.47 × 828.67 px on desktop; 360 × 261.58 px on mobile). Browser console: 0 errors and 0 warnings.

## Adversarial copy and transition pass

- Replaced fatigue-led copy with a factual product frame: “Tus fuentes. Tu criterio.”
- Names the four concrete outputs once; avoids claims about saving time, improving teaching, or replacing judgment.
- Removed the defensive “Nada más” and the repeated professor-origin statement from the closing section.
- Standardized the conversion language around one ten-day trial; removed the conflicting “acceso anticipado”.
- The complete application screenshot starts entering at 0% film progress, is clearly recognizable at 8%, and reaches its resting position at 16%.
- Added a restrained translucent vignette over the film and an alpha-aware shadow around the real application silhouette. The interface itself remains opaque and uncropped.
