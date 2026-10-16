/**
 * Dealer information in an AI draft must come from an authenticated database
 * profile, never from arbitrary client-supplied seller claims.
 *
 * Auction listings do not permit contact exchange before a win. Intentionally
 * omit street addresses, website, email and telephone from public descriptions.
 */
export interface DealerDescriptionFacts {
    companyName?: string | null;
    businessAddress?: string | null;
    description?: string | null;
    warrantyOffered?: boolean | null;
    warrantyDetails?: string | null;
    financeOffered?: boolean | null;
    financeDetails?: string | null;
}

export function publicDealerCopy(text: string | null | undefined): string {
    return (text || '')
        .replace(/(?:https?:\/\/|www\.)[^\s]+/gi, '')
        .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '')
        .replace(/(?:\+44[\s.-]?|0)(?:\d[\s().-]?){9,11}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function dealerPublicArea(address: string | null | undefined): string {
    if (!address) return '';
    const chunks = address.split(',').map(x => x.trim()).filter(Boolean);
    // An address can be "Street, City, Postcode". Never use the street
    // component even if the seller has a complete address stored for KYC.
    const publicChunks = chunks.length > 1 ? chunks.slice(1) : [];
    return publicChunks
        .filter(part => !/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(part))
        .filter(part => !/^(?:UK|United Kingdom|England|Scotland|Wales)$/i.test(part))
        .slice(0, 2)
        .map(part => publicDealerCopy(part))
        .filter(Boolean)
        .join(', ')
        .slice(0, 100);
}

export function dealerDescriptionAppendix(facts?: DealerDescriptionFacts | null): string {
    if (!facts) return '';
    const companyName = publicDealerCopy(facts.companyName).slice(0, 100);
    const area = dealerPublicArea(facts.businessAddress);
    const bio = publicDealerCopy(facts.description).slice(0, 450);
    const warranty = facts.warrantyOffered && facts.warrantyDetails
        ? publicDealerCopy(facts.warrantyDetails) : '';
    const finance = facts.financeOffered && facts.financeDetails
        ? publicDealerCopy(facts.financeDetails) : '';
    const items = [
        companyName ? 'About the dealer: ' + companyName + (area ? ' — based in ' + area + '.' : '.') : area ? 'Dealer location: ' + area + '.' : '',
        bio,
        warranty ? 'Warranty offered (dealer-stated terms): ' + warranty : '',
        finance ? 'Finance available, subject to eligibility and lender approval (dealer-stated): ' + finance : '',
    ].filter(Boolean);
    return items.length ? items.join('\n') : '';
}
