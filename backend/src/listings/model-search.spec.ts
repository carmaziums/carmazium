import { modelSearchWhere, makeSearchWhere } from './model-search';

function matches(selected: string, saved: string, make?: string) {
    return modelSearchWhere(selected, make).OR.some(({ model }) => {
        const value = saved.toLowerCase();
        return 'equals' in model ? value === model.equals!.toLowerCase()
            : value.startsWith(model.startsWith!.toLowerCase());
    });
}
describe('selected vehicle models', () => {
    it('matches a make repeated in imported model text without broadening to another model', () => {
        expect(matches('A4', 'Audi A4', 'Audi')).toBe(true);
        expect(matches('C3', 'Citroen C3 Aircross', 'Citroën')).toBe(true);
        expect(matches('Ceed', 'Kia Xceed', 'Kia')).toBe(false);
        expect(matches('up!', 'UP', 'Volkswagen')).toBe(true);
    });
    it.each([
        ['Ceed', 'CEED', true], ['Ceed', 'CEED GT LINE', true],
        ['Ceed', 'XCEED', false], ['Ceed', 'PROCEED', false],
        ['A1', 'A1 SPORT', true], ['A1', 'A110', false],
        ['C-Class', 'C CLASS AMG LINE', true], ['C Class', 'C-CLASS', true],
        [' Range Rover ', 'RANGE ROVER SPORT', true], ['Golf', 'GOLF-R', true],
    ])('%s matches %s: %s', (selected, saved, expected) => {
        expect(matches(selected, saved)).toBe(expected);
    });
});

describe('make spellings', () => {
    it.each(['Citroën', 'CITROEN'])('%s includes the accented and DVLA spelling', make => {
        expect(makeSearchWhere(make).OR.map(x => x.make.equals.toLowerCase())).toEqual(expect.arrayContaining(['citroen', 'citroën']));
    });
    it('does not treat a make as an arbitrary substring', () => {
        expect(makeSearchWhere('MG')).toEqual({ OR: [{ make: { equals: 'MG', mode: 'insensitive' } }] });
    });
});
