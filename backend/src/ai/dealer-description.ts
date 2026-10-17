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

/**
 * Scrub direct contact/location clues from both saved dealer copy and AI output.
 * Auction descriptions must never become a pre-win contact channel.
 * This is intentionally conservative: the dealer's general area is generated
 * separately from structured businessAddress, not copied from free text.
 */
export function publicDealerCopy(text: string | null | undefined): string {
    return (text || '')
        .replace(/(?:https?:\/\/|www\.)[^\s]+/gi, '')
        .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '')
        .replace(/\b(?:[a-z0-9-]+\.)+(?:co\.uk|org\.uk|ac\.uk|gov\.uk|com|net|org|io|uk|info|biz)\b(?:\/[^\s]*)?/gi, '')
        .replace(/(?:\+44[\s().-]?|0)(?:\d[\s().-]?){9,11}/g, '')
        .replace(/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/gi, '')
        .replace(/\b\d{1,5}[A-Z]?(?:[-/]\d{1,5}[A-Z]?)?\s+(?:(?:[A-Z][\w'-]*\s+){0,5})(?:Road|Rd|Street|St|Lane|Ln|Avenue|Ave|Drive|Dr|Close|Crescent|Court|Ct|Way|Place|Pl|Gardens|Gdns|Terrace|Square|Sq)\b\.?/gi, '')
        .replace(/@[a-z0-9_.]+/gi, '')
        .replace(/\s+,/g, ',')
        .replace(/(?:,\s*){2,}/g, ', ')
        .replace(/,\s*(?=[.!?]|$)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function dealerPublicArea(address: string | null | undefined): string {
    if (!address) return '';
    const chunks = address.split(',').map(x => x.trim()).filter(Boolean);
    // Keep a plain city/region even when it is the only saved value.
    // A first component with house-number or postcode is never an area.
    const possibleAreas = chunks.length > 1 && /\d/.test(chunks[0]) ? chunks.slice(1) : chunks;
    return possibleAreas
        .filter(part => !/\d/.test(part))
        .filter(part => !/\b(?:Road|Rd|Street|St|Lane|Ln|Avenue|Ave|Drive|Dr|Close|Crescent|Court|Ct|Way|Place|Pl|Gardens|Gdns|Terrace|Square|Sq)\b/i.test(part))
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
