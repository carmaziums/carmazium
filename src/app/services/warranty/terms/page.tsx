import Link from 'next/link'
export default function WarrantyOrderInformation() {
    return <main className="container mx-auto max-w-3xl px-5 pt-28 pb-20 space-y-6">
        <h1 className="text-3xl font-bold">Before you order a warranty</h1>
        <p>CarMazium provides the platform and collects the displayed payment through Stripe. Pulse Cars Limited arranges the Warrantywise warranty as broker. CarMazium and Pulse Cars Limited do not carry out warranty repairs through this checkout.</p>
        <h2 className="text-xl font-bold">Your quote and payment</h2>
        <p>Your quote is based on the vehicle category and options you select. All displayed prices include VAT. Check the vehicle details, current mileage, service history, repair limit, labour allowance and optional additions before paying. This payment purchases a warranty order, not the vehicle.</p>
        <h2 className="text-xl font-bold">Issuance and cover</h2>
        <p>Payment does not immediately activate warranty cover. Admin checks the details, arranges the selected warranty and pays the supplier separately. We then send the warranty reference and confirmed cover dates. The requested start date is not a guarantee of cover before issuance.</p>
        <p>Vehicle eligibility, covered components, service requirements, exclusions and repair authorisation are governed by the issued Warrantywise plan. A repair limit or optional addition does not mean every fault or repair is covered. Known and pre-existing faults must be disclosed. Do not authorise repairs on the assumption that this order covers them.</p>
        <p>If we cannot arrange the selected cover, we will contact you and refund your payment. We will not substitute lower cover without discussing it with you. For cancellation or questions about an issued warranty, contact our team and refer to the cancellation terms supplied with your plan. This information does not limit your statutory rights.</p>
        <p><a className="underline" href="https://www.warrantywise.co.uk/" target="_blank" rel="noopener noreferrer">Read Warrantywise’s product and plan information</a>. Your issued plan documents confirm the terms that apply to your vehicle.</p>
        <h2 className="text-xl font-bold">Your information</h2>
        <p>We use the details you supply to prepare the quote, take payment, arrange the warranty and send order updates. We share the necessary details with Pulse Cars Limited and Warrantywise for fulfilment. Stripe handles your card details. See our <Link className="underline" href="/privacy-policy">Privacy Policy</Link>.</p>
        <p>Quote/order information version: 13 November 2026.</p>
        <div className="flex gap-5"><Link className="underline" href="/services/warranty">Back to warranty quotes</Link><Link className="underline" href="/contact">Contact the team</Link></div>
    </main>
}
