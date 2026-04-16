import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { TrackResponse } from "./types";

type State = {
  consignments: string[];
  tracking: TrackResponse | null;
  setConsignments: (c: string[]) => void;
  setTracking: (t: TrackResponse | null) => void;
  clear: () => void;
};

const Ctx = createContext<State | null>(null);

/** Legacy keys — remove once so old sessions do not retain large payloads. */
const LEGACY_LS_CONS = "ip_consignments";
const LEGACY_LS_TRACK = "ip_tracking";

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [consignments, setConsignmentsState] = useState<string[]>([]);
  const [tracking, setTrackingState] = useState<TrackResponse | null>(null);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_LS_CONS);
      localStorage.removeItem(LEGACY_LS_TRACK);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<State>(
    () => ({
      consignments,
      tracking,
      setConsignments: (c) => {
        setConsignmentsState(c);
      },
      setTracking: (t) => {
        setTrackingState(t);
      },
      clear: () => {
        setConsignmentsState([]);
        setTrackingState(null);
      }
    }),
    [consignments, tracking]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTracking() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTracking must be used within TrackingProvider");
  return ctx;
}
