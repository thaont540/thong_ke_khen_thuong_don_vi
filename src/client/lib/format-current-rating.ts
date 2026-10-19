import type { CurrentRating } from "../../shared/schemas/officer-schemas";

/** "Hoàn thành tốt nhiệm vụ (2025)", or an em dash when the officer has no rating record yet. */
export const formatCurrentRating = (r: CurrentRating | null): string =>
  r ? `${r.name} (${r.year})` : "—";
