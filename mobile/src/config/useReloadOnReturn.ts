import { useEffect, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";

/**
 * Reloads a screen's data when the person comes back to it (another tab, or
 * back from a detail screen), so it shows the same records as the website
 * instead of what was loaded earlier. The first load stays with the screen's
 * own effect; pull-to-refresh still works as before.
 */
export function useReloadOnReturn(reload: () => void) {
  const isFocused = useIsFocused();
  const wasFocused = useRef(isFocused);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (isFocused && !wasFocused.current) reloadRef.current();
    wasFocused.current = isFocused;
  }, [isFocused]);
}
