export function canonicalMake(value: string): string {
    const name = value.trim()
    if (/^mercedes(?:[- ]?benz)?$/i.test(name)) return 'Mercedes-Benz'
    if (/^dodge(?:[ -]?usa| ?\(usa\))?$/i.test(name)) return 'Dodge'
    if (/^citro[eë]n$/i.test(name)) return 'Citroën'
    if (/^[sš]koda$/i.test(name)) return 'Skoda'
    return name
}
export function sameMake(left: string, right: string): boolean {
    return canonicalMake(left).toLowerCase() === canonicalMake(right).toLowerCase()
}
