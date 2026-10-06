import { useEffect, useState } from "react";

/** Consulta responsive reactiva; el valor de reserva mantiene tests/SSR estables. */
export function useMediaQuery(query: string, fallback = false): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.(query).matches === true,
  );

  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) {
      setMatches(fallback);
      return;
    }
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query, fallback]);

  return matches;
}
