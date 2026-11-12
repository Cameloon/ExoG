import { createContext, useContext } from "react";
// Portals render outside the app wrapper; carry its existing theme with them.
export const AppAppearanceContext = createContext<string | undefined>(undefined);
export const useAppAppearance = () => useContext(AppAppearanceContext);
