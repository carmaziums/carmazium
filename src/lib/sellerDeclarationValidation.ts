/**
 * Seller declarations shared by Step 1 validation and its inline summary.
 * "No" is a valid answer to the import question (which is not mandatory).
 * A seller who is not the registered keeper can still proceed after declaring
 * their relationship/authority; never require them to falsely select "Yes".
 */
export interface SellerDeclarations {
    writeOffCategory: string
    stolenRecovered: boolean | null
    hasOutstandingFinance: boolean | null
    isLegalRegisteredKeeper: boolean | null
    notOwnerRelationship?: string | null
    isDepartedSale: boolean
    departedRelationship?: string | null
    declarationAcknowledged: boolean
}

export function getMissingSellerDeclarations(value: SellerDeclarations): string[] {
    const missing: string[] = []
    if (!value.writeOffCategory) missing.push("insurance write-off status")
    if (value.stolenRecovered === null) missing.push("stolen/recovered answer")
    if (value.hasOutstandingFinance === null) missing.push("outstanding finance answer")
    if (value.isLegalRegisteredKeeper === null) missing.push("registered keeper answer")
    if (value.isLegalRegisteredKeeper === false && !value.notOwnerRelationship?.trim()) {
        missing.push("relationship to the registered keeper")
    }
    if (value.isDepartedSale && !value.departedRelationship?.trim()) {
        missing.push("estate/departed-sale relationship")
    }
    if (!value.declarationAcknowledged) missing.push("confirmation checkbox")
    return missing
}

/** Only show a warning after the seller attempts to continue. */
export function sellerDeclarationErrorMessage(missing: readonly string[]): string | null {
    if (!missing.length) return null
    if (missing.length === 1 && missing[0] === "confirmation checkbox") {
        return "Please tick the confirmation box to continue."
    }
    return `Please complete: ${missing.join(", ")}.`
}
