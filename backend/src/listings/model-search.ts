/** Match a selected model and its derivatives, not another model containing it
 * (Ceed must not include Xceed; A1 must not include A110).
 * Saved DVLA model names can use either spaces or hyphens, e.g. C CLASS / C-Class.
 * Free-text keyword search remains available for arbitrary partial matches.
 */
export function modelSearchWhere(model: string, make?: string) {
    const name = model.trim().replace(/\s+/g, ' ');
    const aliases = new Set([name, name.replace(/-/g, ' '), name.replace(/ /g, '-'), name.replace(/!$/, '')]);
    const unprefixed = [...aliases];
    if (make?.trim()) {
        for (const { make: m } of makeSearchWhere(make).OR) {
            for (const value of unprefixed) {
                if (!value.toLowerCase().startsWith(m.equals.toLowerCase() + ' ')) aliases.add(`${m.equals} ${value}`);
            }
        }
    }
    const names = [...aliases];
    return { OR: names.flatMap(value => [
        { model: { equals: value, mode: 'insensitive' as const } },
        { model: { startsWith: `${value} `, mode: 'insensitive' as const } },
        { model: { startsWith: `${value}-`, mode: 'insensitive' as const } },
    ]) };
}

/** Known make spelling variants; exact selections must work with DVLA spelling. */
export function makeSearchWhere(make: string) {
    const value = make.trim();
    const plain = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const aliases = new Set([value, plain]);
    if (/^citro[eë]n$/i.test(value)) { aliases.add('Citroën'); aliases.add('Citroen'); }
    if (/^skoda$/i.test(plain)) { aliases.add('Skoda'); aliases.add('Škoda'); }
    return { OR: [...aliases].map(name => ({ make: { equals: name, mode: 'insensitive' as const } })) };
}
