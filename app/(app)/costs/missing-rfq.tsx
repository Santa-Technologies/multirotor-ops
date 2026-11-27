import { ActionDialog } from "@/components/action-dialog";
import { buildMissingRfqItems } from "@/lib/costing/missing-rfq";

import { BulkRfqClient, SetDistributorEmailForm } from "./missing-rfq-client";

/**
 * Server wrapper: resolves missing cost flags into Ready-to-RFQ rows, then
 * hands a client checkbox board for bulk send.
 */
export async function MissingPartsRfqPanel({
  costRunId,
  productName,
  flags,
}: {
  costRunId: string;
  productName: string;
  flags: Array<Record<string, unknown>>;
}) {
  const items = await buildMissingRfqItems(flags);
  if (items.length === 0) return null;

  const needingEmail = items.filter((i) => i.distributorId && !i.rfqEmail);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">
          Ready to RFQ · {productName}
        </h2>
        <p className="text-xs text-muted-foreground">
          From cost run missing flags · {costRunId.slice(0, 8)}…
        </p>
      </div>

      {needingEmail.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {needingEmail.map((item) =>
            item.distributorId ? (
              <ActionDialog
                key={item.distributorId}
                triggerLabel={`Set email · ${item.distributorName ?? "distributor"}`}
                title="Set distributor RFQ email"
                triggerVariant="outline"
              >
                <SetDistributorEmailForm
                  distributorId={item.distributorId}
                  distributorName={item.distributorName ?? "Distributor"}
                />
              </ActionDialog>
            ) : null,
          )}
        </div>
      ) : null}

      <BulkRfqClient items={items} />
    </div>
  );
}
