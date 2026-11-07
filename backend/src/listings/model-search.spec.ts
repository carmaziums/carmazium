import { modelSearchWhere } from './model-search';

function matches(selected: string, saved: string) {
    return modelSearchWhere(selected).OR.some(({ model }) => {
        const value = saved.toLowerCase();
        return 'equals' in model ? value === model.equals!.toLowerCase()
            : value.startsWith(model.startsWith!.toLowerCase());
    });
}
describe('selected vehicle models', () => {
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
