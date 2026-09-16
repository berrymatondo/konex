import { Suspense } from "react"
import { BccPrototypePage } from "@/components/bcc/bcc-prototype-page"

export default function CentralBankPurchaseOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <BccPrototypePage section="purchase-orders" />
    </Suspense>
  )
}
