import { useContext } from "react";

import { CrmStoreContext } from "./CrmStoreContext";

export function useCrmStore() {
  const context = useContext(CrmStoreContext);

  if (!context) {
    throw new Error(
      "useCrmStore must be used inside CrmStoreProvider.",
    );
  }

  return context;
}