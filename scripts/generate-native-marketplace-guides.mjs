import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const ts = createRequire(new URL('../carmazium app/carmazium app/package.json', import.meta.url))('typescript');
const root = path.resolve(import.meta.dirname, '..');
const sources = {
 marketplace: ['src/app/how-it-works/page.tsx', ['SELLER_STEPS','DEALER_STEPS','RECEIPTS','TRUST_STRIP','BID_LOG']],
 auction: ['src/components/auctions/HowAuctionsWork.tsx', ['SELLER_STEPS','BUYER_STEPS','RULES','TRUST','FAQS']],
};
const result = {};
function literal(n) {
 if(ts.isAsExpression(n))return literal(n.expression);
 if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;
 if(ts.isNumericLiteral(n))return Number(n.text);
 if(n.kind===ts.SyntaxKind.TrueKeyword)return true;
 if(n.kind===ts.SyntaxKind.FalseKeyword)return false;
 if(ts.isArrayLiteralExpression(n))return n.elements.map(literal);
 if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.filter(p=>p.name?.getText()!=='icon').map(p=>{if(!ts.isPropertyAssignment(p))throw Error('Non-literal guide property');return[p.name.getText().replace(/^['"]|['"]$/g,''),literal(p.initializer)];}));
 throw Error('Unsupported guide expression: '+n.getText());
}
for(const[key,[file,names]]of Object.entries(sources)){
 const source=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),values={};
 function visit(n){if(ts.isVariableDeclaration(n)&&names.includes(n.name.getText(source)))values[n.name.getText(source)]=literal(n.initializer);ts.forEachChild(n,visit);}
 visit(source);for(const name of names)if(!(name in values))throw Error('Missing guide data '+name);result[key]=values;
}
const destination=path.join(root,'carmazium app/carmazium app/src/data/marketplaceGuides.json'),output=JSON.stringify(result,null,2)+'\n';
const normaliseLines = text => text.replace(/\r\n?/g, '\n');
if(process.argv.includes('--check')){
  // Windows Git checkouts may use CRLF even when the canonical generated JSON
  // is LF. Compare content, not platform-specific line separators.
  if(normaliseLines(fs.readFileSync(destination,'utf8')) !== normaliseLines(output))
    throw Error('Native marketplace guide content differs from website');
  console.log('Native marketplace guide content matches website');
}else fs.writeFileSync(destination,output);
