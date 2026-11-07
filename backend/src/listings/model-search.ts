/** Match a selected model and its derivatives, not another model containing it
 * (Ceed must not include Xceed; A1 must not include A110).
 * Saved DVLA model names can use either spaces or hyphens, e.g. C CLASS / C-Class.
 * Free-text keyword search remains available for arbitrary partial matches.
 */
export function modelSearchWhere(model: string) {
    const name = model.trim().replace(/\s+/g, ' ');
    const names = [...new Set([name, name.replace(/-/g, ' '), name.replace(/ /g, '-')])];
    return { OR: names.flatMap(value => [
        { model: { equals: value, mode: 'insensitive' as const } },
        { model: { startsWith: `${value} `, mode: 'insensitive' as const } },
        { model: { startsWith: `${value}-`, mode: 'insensitive' as const } },
    ]) };
}
