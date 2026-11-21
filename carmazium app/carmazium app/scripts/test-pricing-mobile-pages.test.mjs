import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const compile=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
async function mount(name='PricingScreen',signedIn=true){
 const prices={};runInNewContext(compile(readFileSync(new URL('../src/constants/pricing.ts',import.meta.url),'utf8')),{exports:prices});const nav=[];
 const modules={react:React,'react-native':{useWindowDimensions:()=>({width:600,fontScale:1}),View:'View',Text:'Text',ScrollView:'ScrollView',StatusBar:'StatusBar',TouchableOpacity:'TouchableOpacity',StyleSheet:{create:s=>s}},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},'expo-linear-gradient':{LinearGradient:'Gradient'},'@/components/BrandIcon':{Ionicons:'Icon'},'@react-navigation/native':{useNavigation:()=>({navigate:(...args)=>nav.push(args)})},'../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{},FontSize:{}},'../../constants/spacing':{Elevation:{},Radius:{}},'../../constants/pricing':prices,'../../components/IconButton':{IconButton:'IconButton'},'../../components/WebsiteTopBar':{WebsiteTopBar:'Header'},'../../components/NativePage':{NativePage:'NativePage',pageStyles:{}},'../../components/Button':{Button:'Button'},'../../store/authStore':{useAuthStore:fn=>fn({isAuthenticated:signedIn})}};
 const exports={};runInNewContext(compile(readFileSync(new URL('../src/screens/main/PricingScreen.tsx',import.meta.url),'utf8')),{exports,require:n=>{if(!(n in modules))throw Error(n);return modules[n];}});let t;await act(async()=>{t=create(React.createElement(exports[name]));});return {t,nav};
}
const click=(t,label)=>act(async()=>t.root.findAllByType('Button').find(n=>n.props.label===label).props.onPress());
test('all four customer packages open native selling with the selected channel and tier',async()=>{
 const {t,nav}=await mount();for(const label of ['Start Free Auction','Choose Basic','Choose Standard','Choose Premium'])await click(t,label);
 assert.deepEqual(JSON.parse(JSON.stringify(nav)),[['SellLanding',{listingType:'AUCTION'}],...['BASIC','STANDARD','PREMIUM'].map(badgeTier=>['SellLanding',{listingType:'CLASSIFIED',badgeTier}])]);
 const faq=t.root.findAllByType('TouchableOpacity').find(n=>n.props.accessibilityLabel==='How does the £100 auction seller reward work?');assert.equal(faq.props.accessibilityState.expanded,false);await act(async()=>faq.props.onPress());assert.equal(faq.props.accessibilityState.expanded,true);assert.ok(t.root.findAllByType('Text').some(n=>String(n.props.children).includes('Once the handover is approved')));await act(async()=>t.unmount());
});
test('trader pricing uses native browsing and signed-in partner destination',async()=>{
 const {t,nav}=await mount('TraderPricingScreen');for(const label of ['Browse Auctions','Browse Retail Cars','Open Partner Account','Customer Pricing'])await click(t,label);assert.deepEqual(JSON.parse(JSON.stringify(nav)),[['Tabs',{screen:'Live'}],['Tabs',{screen:'Search'}],['PartnerDashboard'],['Pricing']]);await act(async()=>t.unmount());
 const guest=await mount('TraderPricingScreen',false);await click(guest.t,'Create Partner Account');assert.equal(guest.nav[0][0],'DealerOnboarding');await act(async()=>guest.t.unmount());
});

test('selected retail tier survives valuation handoff and never gives an auction a paid badge',()=>{
 const screen=readFileSync(new URL('../src/screens/sell/SellLandingScreen.tsx',import.meta.url),'utf8');const wizard=readFileSync(new URL('../src/screens/sell/SellCarFlowScreen.tsx',import.meta.url),'utf8');
 const expressions={};for(const [name,source]of [['landing',screen],['wizard',wizard]]){const ast=ts.createSourceFile(name+'.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='startListing')expressions.start=n.initializer.getText(ast);if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.name.elements[0]?.name.getText(ast)==='badgeTier')expressions.tier=n.initializer.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(ast);}
 const calls=[];const context={navigation:{navigate:(...args)=>calls.push(args)},selectedTier:'PREMIUM',valuation:null,vrm:'',make:'',model:'',year:'',mileage:'',transmission:'',dvlaDetails:null,validYear:()=>false};runInNewContext(compile('globalThis.start='+expressions.start),context);context.start('CLASSIFIED');context.start('AUCTION');assert.equal(calls[0][1].badgeTier,'PREMIUM');assert.equal(calls[1][1].badgeTier,undefined);
 for(const [listingType,badgeTier,editListingId,expected]of [['CLASSIFIED','PREMIUM',null,'PREMIUM'],['CLASSIFIED','STANDARD',null,'STANDARD'],['CLASSIFIED','INVALID',null,'BASIC'],['AUCTION','PREMIUM',null,'FREE'],['CLASSIFIED','PREMIUM','edit-id','BASIC']]){const c={landingListingType:listingType,editListingId,route:{params:{badgeTier}}};runInNewContext(compile('globalThis.tier='+expressions.tier),c);assert.equal(c.tier,expected);}
});

test('customer pricing renders the website package facts and independent FAQ disclosures',async()=>{
 const {t}=await mount();
 const text=()=>t.root.findAllByType('Text').flatMap(n=>n.children.filter(x=>typeof x==='string')).join(' ');
 for(const expected of ['HISTORY REPORT INCLUDED','Offers and buyer chat','Vehicle history checks remain optional','Featured Boost still optional','Retail buyers pay £0','Vehicle history report option','Direct vehicle payment','No subscriptions'])assert.ok(text().includes(expected),expected);
 assert.equal(text().includes('DVLA auto-fill'),false);
 const disclosures=t.root.findAllByType('TouchableOpacity').filter(n=>n.props.accessibilityState&&'expanded' in n.props.accessibilityState);
 assert.equal(disclosures.length,6);
 await act(async()=>disclosures[0].props.onPress());await act(async()=>disclosures[1].props.onPress());
 assert.equal(disclosures[0].props.accessibilityState.expanded,true);assert.equal(disclosures[1].props.accessibilityState.expanded,true);
 await act(async()=>disclosures[0].props.onPress());assert.equal(disclosures[1].props.accessibilityState.expanded,true);
 await act(async()=>t.unmount());
});
test('native primary and muted theme colours track website light and dark tokens',()=>{
 const exports={};runInNewContext(compile(readFileSync(new URL('../src/constants/colors.ts',import.meta.url),'utf8')),{exports});
 const css=readFileSync(new URL('../../../src/app/globals.css',import.meta.url),'utf8');
 for(const [mode,selector]of [['light',':root'],['dark','.dark']]){
   const block=css.slice(css.indexOf(selector+' {')).split('}')[0];
   for(const [key,variable]of [['accent','--color-primary'],['textMuted','--text-muted']]){
     const expected=block.match(new RegExp(variable+':\\s*(#[a-fA-F0-9]+)'))?.[1];
     assert.equal(exports.palettes[mode][key].toLowerCase(),expected.toLowerCase(),mode+' '+key);
   }
 }
});
