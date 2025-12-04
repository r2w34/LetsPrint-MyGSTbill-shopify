import type { LoaderFunctionArgs } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { PrismaClient } from "@prisma/client";
import { InvoiceService } from "../lib/services/invoice-service";

const prisma = new PrismaClient();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const invoiceService = new InvoiceService(prisma);

  try {
    const stats = await invoiceService.getInvoiceStats(session.shop);
    return json(stats);
  } catch (error) {
    console.error("Error fetching invoice stats:", error);
    return json(
      { error: "Failed to fetch invoice statistics" },
      { status: 500 }
    );
  }
};