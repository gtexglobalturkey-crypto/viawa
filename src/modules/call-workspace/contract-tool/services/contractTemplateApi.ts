import type { ContractTemplateStatus } from "../model/ContractTemplateStatus";

export async function fetchContractTemplateStatus(): Promise<
  ContractTemplateStatus
> {
  const response = await fetch(
    "/api/contract-template/status",
  );

  if (!response.ok) {
    throw new Error(
      "Sözleşme şablonu durumu alınamadı.",
    );
  }

  return (await response.json()) as ContractTemplateStatus;
}

export async function openContractTemplate(): Promise<void> {
  const response = await fetch(
    "/api/contract-template/open",
  );

  if (!response.ok) {
    const data = (await response
      .json()
      .catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(
      data?.error ??
        "Sözleşme şablonu açılamadı.",
    );
  }
}
