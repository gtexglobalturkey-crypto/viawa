/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type WorkspaceMode =
  | "manual"
  | "automatic";

type WorkspaceHeaderState = {
  aiConfidence: number | null;
  aiConfidenceLabel: string;
};

type WorkspaceHeaderContextValue =
  WorkspaceHeaderState & {
    mode: WorkspaceMode;

    setMode: (
      mode: WorkspaceMode,
    ) => void;

    setWorkspaceHeader: (
      state: WorkspaceHeaderState,
    ) => void;

    clearWorkspaceHeader: () => void;
  };

const initialHeaderState: WorkspaceHeaderState = {
  aiConfidence: null,
  aiConfidenceLabel: "",
};

const WorkspaceHeaderContext =
  createContext<
    WorkspaceHeaderContextValue | undefined
  >(undefined);

type Props = {
  children: ReactNode;
};

export function WorkspaceHeaderProvider({
  children,
}: Props) {
  const [
    workspaceHeader,
    setWorkspaceHeaderState,
  ] = useState<WorkspaceHeaderState>(
    initialHeaderState,
  );

  const [mode, setMode] =
    useState<WorkspaceMode>("manual");

  const setWorkspaceHeader = useCallback(
    (
      state: WorkspaceHeaderState,
    ) => {
      setWorkspaceHeaderState(
        (currentState) => {
          if (
            currentState.aiConfidence ===
              state.aiConfidence &&
            currentState.aiConfidenceLabel ===
              state.aiConfidenceLabel
          ) {
            return currentState;
          }

          return state;
        },
      );
    },
    [],
  );

  const clearWorkspaceHeader =
    useCallback(() => {
      setWorkspaceHeaderState(
        (currentState) => {
          if (
            currentState.aiConfidence === null &&
            currentState.aiConfidenceLabel === ""
          ) {
            return currentState;
          }

          return initialHeaderState;
        },
      );
    }, []);

  const value = useMemo(
    () => ({
      ...workspaceHeader,
      mode,
      setMode,
      setWorkspaceHeader,
      clearWorkspaceHeader,
    }),
    [
      workspaceHeader,
      mode,
      setWorkspaceHeader,
      clearWorkspaceHeader,
    ],
  );

  return (
    <WorkspaceHeaderContext.Provider
      value={value}
    >
      {children}
    </WorkspaceHeaderContext.Provider>
  );
}

export function useWorkspaceHeader() {
  const context = useContext(
    WorkspaceHeaderContext,
  );

  if (!context) {
    throw new Error(
      "useWorkspaceHeader must be used inside WorkspaceHeaderProvider.",
    );
  }

  return context;
}