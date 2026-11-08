/**
 * `@mirafive/astro/client`: the page's MIRA FIVE client, for your own scripts. The integration
 * starts it; calls made before that are kept and replayed.
 *
 * ```astro
 * <script>
 *   import { mira } from "@mirafive/astro/client";
 *   document.querySelector("#signup")?.addEventListener("click", () => mira.track("signup_clicked"));
 * </script>
 * ```
 */
import { createMira } from "@mirafive/web";

export const mira = createMira();

export type { EventMap, Mira, SurveyInput } from "@mirafive/web";
