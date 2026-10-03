import { KNOWN_MODELS_BY_MAKE } from './vehicle-model-catalog';

export type VehicleModelRecognition = {
    model: string;
    variant?: string;
    recognised: boolean;
    method: 'CATALOG' | 'BMW_BODY_ALIAS' | 'FORMAT_ONLY';
    suggestions: string[];
};

function plain(value: string): string {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function makeCatalog(make: string): string[] {
    const key = Object.keys(KNOWN_MODELS_BY_MAKE)
        .find(candidate => plain(candidate).replace(/ /g, '') === plain(make).replace(/ /g, ''));
    return key ? KNOWN_MODELS_BY_MAKE[key] : [];
}

function editDistanceOne(a: string, b: string): boolean {
    if (Math.min(a.length, b.length) < 3 || Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++edits > 1) return false;
        if (a.length > b.length) i++;
        else if (b.length > a.length) j++;
        else { i++; j++; }
    }
    return edits + Number(i < a.length || j < b.length) === 1;
}

function originalTrimSuffix(raw: string, make: string, year: string, model: string): string | null {
    const escaped = (part: string) => part.replace(/[^A-Z0-9]/gi, '\\part.replace(/[.*+?^\x24{}()|[\]\\]/g, '\\/**
 * Safe, make-aware parsing')');
    const tolerant = (name: string) => plain(name).split(' ').map(escaped).join('[^A-Za-z0-9]*');
    let text = raw.trim();
    if (year) text = text.replace(new RegExp('^' + year + '\\s+', 'i'), '').trim();
    const makePattern = tolerant(make);
    while (makePattern && new RegExp('^' + makePattern + '(?:\\s+|$)', 'i').test(text)) {
        text = text.replace(new RegExp('^' + makePattern + '(?:\\s+|$)', 'i'), '').trim();
    }
    if (year) text = text.replace(new RegExp('\\s+' + year + ' of model text supplied by either an MOT record or a
 * customer. Only known catalogue matches are split into model + trim; unknown
 * models are preserved rather than guessed from partial word matches.
 *
 * No AI inference or external network access is needed for this step.
 */
export function recogniseVehicleModel(input: {
    make: string; model: string; variant?: string | null; year?: number;
}): VehicleModelRecognition {
    const raw = (input.model || '').trim();
    let value = plain(raw);
    const make = plain(input.make || '');
    const year = input.year ? String(input.year) : '';
    if (year) value = value.replace(new RegExp('^' + year + '\\s+'), '');
    // A duplicated make is common with free text, including multiword makes.
    while (make && (value === make || value.startsWith(make + ' '))) {
        value = value.slice(make.length).trim();
    }
    if (year) value = value.replace(new RegExp('\\s+' + year + '$'), '').trim();

    const catalog = makeCatalog(input.make);
    const userVariant = (input.variant || '').trim();
    if (!value || /^[A-Z]{2}[0-9]{2}[A-Z]{3}$/.test(value.replace(/ /g, ''))) {
        return { model: '', variant: userVariant || undefined, recognised: false, method: 'FORMAT_ONLY', suggestions: [] };
    }

    // 'BMW 220i Gran Tourer': powertrain/series designation is not a trim-free
    // model name. Retain both the body style and engine designation explicitly.
    if (make === 'BMW') {
        const tourer = value.match(/^(2[0-9]{2}[A-Z]{1,2})\s+GRAN(?:D)?\s+TOURER(?:\s+(.*))?$/);
        if (tourer) {
            const suffix = [tourer[1], tourer[2], userVariant].filter(Boolean).join(' ');
            return { model: '2 Series Gran Tourer', variant: suffix || undefined,
                recognised: true, method: 'BMW_BODY_ALIAS', suggestions: [] };
        }
    }

    // A few well-established spelling variants, limited to a confirmed make.
    if (make === 'NISSAN') value = value.replace(/^XTRAIL(?= |$)/, 'X TRAIL');
    if (make === 'TOYOTA') value = value.replace(/^LANDCRUISER(?= |$)/, 'LAND CRUISER');

    // Prefer the longest known model: 'Yaris Cross' before 'Yaris',
    // 'Civic Type R' before 'Civic', and 'A3 Sportback' before 'A3'.
    const matches = catalog
        .map(model => ({ model, key: plain(model) }))
        .filter(item => value === item.key || value.startsWith(item.key + ' '))
        .sort((a, b) => b.key.length - a.key.length);
    const best = matches[0];
    if (best) {
        const suffix = originalTrimSuffix(raw, input.make, year, best.model)
            ?? value.slice(best.key.length).trim();
        const variant = suffix && userVariant && !plain(userVariant).includes(suffix)
            ? suffix + ' ' + userVariant
            : (userVariant || suffix);
        return { model: best.model, variant: variant || undefined,
            recognised: true, method: 'CATALOG', suggestions: [] };
    }

    // Suggestions are displayed to humans; never auto-correct an unverified typo.
    const suggestions = value.includes(' ') ? [] : catalog
        .filter(model => editDistanceOne(value, plain(model)))
        .slice(0, 3);
    return { model: value, variant: userVariant || undefined,
        recognised: false, method: 'FORMAT_ONLY', suggestions };
}
), '').trim();
    const matched = text.match(new RegExp('^' + tolerant(model) + '(?=$|[^A-Za-z0-9])', 'i'));
    return matched ? text.slice(matched[0].length).replace(/^[\\s,:-]+/, '').trim() : null;
}

/**
 * Safe, make-aware parsing of model text supplied by either an MOT record or a
 * customer. Only known catalogue matches are split into model + trim; unknown
 * models are preserved rather than guessed from partial word matches.
 *
 * No AI inference or external network access is needed for this step.
 */
export function recogniseVehicleModel(input: {
    make: string; model: string; variant?: string | null; year?: number;
}): VehicleModelRecognition {
    const raw = (input.model || '').trim();
    let value = plain(raw);
    const make = plain(input.make || '');
    const year = input.year ? String(input.year) : '';
    if (year) value = value.replace(new RegExp('^' + year + '\\s+'), '');
    // A duplicated make is common with free text, including multiword makes.
    while (make && (value === make || value.startsWith(make + ' '))) {
        value = value.slice(make.length).trim();
    }
    if (year) value = value.replace(new RegExp('\\s+' + year + '$'), '').trim();

    const catalog = makeCatalog(input.make);
    const userVariant = (input.variant || '').trim();
    if (!value || /^[A-Z]{2}[0-9]{2}[A-Z]{3}$/.test(value.replace(/ /g, ''))) {
        return { model: '', variant: userVariant || undefined, recognised: false, method: 'FORMAT_ONLY', suggestions: [] };
    }

    // 'BMW 220i Gran Tourer': powertrain/series designation is not a trim-free
    // model name. Retain both the body style and engine designation explicitly.
    if (make === 'BMW') {
        const tourer = value.match(/^(2[0-9]{2}[A-Z]{1,2})\s+GRAN(?:D)?\s+TOURER(?:\s+(.*))?$/);
        if (tourer) {
            const suffix = [tourer[1], tourer[2], userVariant].filter(Boolean).join(' ');
            return { model: '2 Series Gran Tourer', variant: suffix || undefined,
                recognised: true, method: 'BMW_BODY_ALIAS', suggestions: [] };
        }
    }

    // A few well-established spelling variants, limited to a confirmed make.
    if (make === 'NISSAN') value = value.replace(/^XTRAIL(?= |$)/, 'X TRAIL');
    if (make === 'TOYOTA') value = value.replace(/^LANDCRUISER(?= |$)/, 'LAND CRUISER');

    // Prefer the longest known model: 'Yaris Cross' before 'Yaris',
    // 'Civic Type R' before 'Civic', and 'A3 Sportback' before 'A3'.
    const matches = catalog
        .map(model => ({ model, key: plain(model) }))
        .filter(item => value === item.key || value.startsWith(item.key + ' '))
        .sort((a, b) => b.key.length - a.key.length);
    const best = matches[0];
    if (best) {
        const suffix = value.slice(best.key.length).trim();
        const variant = suffix && userVariant && !plain(userVariant).includes(suffix)
            ? suffix + ' ' + userVariant
            : (userVariant || suffix);
        return { model: best.model, variant: variant || undefined,
            recognised: true, method: 'CATALOG', suggestions: [] };
    }

    // Suggestions are displayed to humans; never auto-correct an unverified typo.
    const suggestions = value.includes(' ') ? [] : catalog
        .filter(model => editDistanceOne(value, plain(model)))
        .slice(0, 3);
    return { model: value, variant: userVariant || undefined,
        recognised: false, method: 'FORMAT_ONLY', suggestions };
}
