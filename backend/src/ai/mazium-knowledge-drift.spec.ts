import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
it('requires a reviewed knowledge refresh when source workflows change', () => {
 expect(() => execFileSync(process.execPath, [resolve(__dirname,'../../../scripts/check-mazium-knowledge.mjs')],{stdio:'pipe'})).not.toThrow();
});
