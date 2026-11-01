/**
 * Stripe Checkout's ?paid=1 is a browser redirect, NOT proof of payment.
 * Only backend-confirmed ServicePayment status can unlock success wording.
 */
export type CheckoutPaymentNotice = {
    tone: "success" | "pending" | "warning"
    text: string
}

export function checkoutPaymentNotice(
    checkoutReturn: string | null,
    paymentStatus: string | null | undefined,
): CheckoutPaymentNotice | null {
    if (checkoutReturn !== "1") return null
    if (paymentStatus === "PAID" || paymentStatus === "RELEASED") {
        return {
            tone: "success",
            text: "Payment confirmed. Your job and provider contact options are updated below.",
        }
    }
    if (paymentStatus === "REFUNDED") {
        return { tone: "warning", text: "This service payment has been refunded. Check the job status for details." }
    }
    if (paymentStatus === "FAILED") {
        return { tone: "warning", text: "Payment could not be confirmed. Check your payment status before attempting checkout again." }
    }
    return {
        tone: "pending",
        text: "Checking payment confirmation. Please do not pay again while it is pending. Refresh this page if it does not update, or contact CarMazium support.",
    }
}
