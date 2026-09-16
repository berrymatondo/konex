import { Suspense } from "react"
import { BccPrototypePage } from "@/components/bcc/bcc-prototype-page"

export default function CentralBankCustodyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <BccPrototypePage section="custody" />
    </Suspense>
  )
}
