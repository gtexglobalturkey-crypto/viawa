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
  companyName: string | null;
  companyCode: string | null;
  stageLabel: string | null;
  industry: string | null;
  country: string | null;
};

type WorkspaceHeaderUpdate =
  Partial<WorkspaceHeaderState>;

type WorkspaceHeaderContextValue =
  WorkspaceHeaderState & {
    mode: WorkspaceMode;

    setMode: (
      mode: WorkspaceMode,
    ) => void;

    setWorkspaceHeader: (
      state: WorkspaceHeaderUpdate,
    ) => void;

    clearWorkspaceHeader: () => void;
  };

const initialHeaderState: WorkspaceHeaderState = {
  aiConfidence: null,
  aiConfidenceLabel: "",
  companyName: null,
  companyCode: null,
  stageLabel: null,
  industry: null,
  country: null,
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
      state: WorkspaceHeaderUpdate,
    ) => {
      setWorkspaceHeaderState(
        (currentState) => {
          const nextState: WorkspaceHeaderState = {
            aiConfidence:
              state.aiConfidence ??
              null,
            aiConfidenceLabel:
              state.aiConfidenceLabel ??
              "",
            companyName:
              state.companyName ??
              null,
            companyCode:
              state.companyCode ??
              null,
            stageLabel:
              state.stageLabel ??
              null,
            industry:
              state.industry ??
              null,
            country:
              state.country ??
              null,
          };

          if (
            currentState.aiConfidence ===
              nextState.aiConfidence &&
            currentState.aiConfidenceLabel ===
              nextState.aiConfidenceLabel &&
            currentState.companyName ===
              nextState.companyName &&
            currentState.companyCode ===
              nextState.companyCode &&
            currentState.stageLabel ===
              nextState.stageLabel &&
            currentState.industry ===
              nextState.industry &&
            currentState.country ===
              nextState.country
          ) {
            return currentState;
          }

          return nextState;
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
            currentState.aiConfidenceLabel === "" &&
            currentState.companyName === null &&
            currentState.companyCode === null &&
            currentState.stageLabel === null &&
            currentState.industry === null &&
            currentState.country === null
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
