import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
async function mount(name){
 const nav=[],guides=JSON.parse(readFileSync(new URL('../src/data/marketplaceGuides.json',import.meta.url)));
 const modules={react:React,'react-native':{View:'View',Text:'Text',ScrollView:'ScrollView',TouchableOpacity:'TouchableOpacity',StyleSheet:{create:s=>s},useWindowDimensions:()=>({height:900})},'expo-image':{Image:'Image'},'expo-linear-gradient':{LinearGradient:'Gradient'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0})},'../../components/WebsiteTopBar':{WebsiteTopBar:'Header'},'../../components/Button':{Button:'Button'},'../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{}},'../../data/marketplaceGuides.json':guides};
 const exports={},code=ts.transpileModule(readFileSync(new URL('../src/screens/main/HowItWorksScreen.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports,require:n=>{if(!(n in modules))throw Error(n);return modules[n]}});
 let tree;await act(async()=>{tree=create(React.createElement(exports[name],{navigation:{navigate:(...args)=>nav.push(args)}}))});return{tree,nav,guides};
}
test('marketplace explanation retains both six-step flows, qualifying reward wording and native actions',async()=>{
 const{tree,nav,guides}=await mount('HowItWorksScreen'),output=JSON.stringify(tree.toJSON());
 for(const step of [...guides.marketplace.SELLER_STEPS,...guides.marketplace.DEALER_STEPS])assert.ok(output.includes(step.desc));
 assert.ok(output.includes('Example figures only'));assert.ok(output.includes('qualifying sales, after approval'));
 for(const node of tree.root.findAllByType('Button'))await act(async()=>node.props.onPress());
 assert.deepEqual(JSON.parse(JSON.stringify(nav)),[['SellLanding',{listingType:'AUCTION'}],['AuctionGuide'],['Tabs',{screen:'Search'}]]);await act(async()=>tree.unmount());
});
test('auction guide shows both complete journeys and opens FAQs and existing native actions',async()=>{
 const{tree,nav,guides}=await mount('AuctionGuideScreen'),output=JSON.stringify(tree.toJSON());
 assert.ok(output.includes('Sell a vehicle at auction'));assert.ok(output.includes('Buy vehicles at auction'));
 for(const step of [...guides.auction.SELLER_STEPS,...guides.auction.BUYER_STEPS])assert.ok(output.includes(step.desc),step.desc);
 assert.equal(tree.root.findAllByType('TouchableOpacity').filter(n=>n.props.accessibilityRole==='tab').length,0);
 for(const faq of guides.auction.FAQS){const node=tree.root.findAllByType('TouchableOpacity').find(n=>n.props.accessibilityLabel===faq.q);assert.equal(node.props.accessibilityState.expanded,false);await act(async()=>node.props.onPress());assert.equal(node.props.accessibilityState.expanded,true);assert.ok(JSON.stringify(tree.toJSON()).includes(faq.a));await act(async()=>node.props.onPress());assert.equal(node.props.accessibilityState.expanded,false);}
 for(const node of tree.root.findAllByType('Button'))await act(async()=>node.props.onPress());
 assert.deepEqual(JSON.parse(JSON.stringify(nav)),[['Services'],['SellLanding',{listingType:'AUCTION'}],['Tabs',{screen:'Live'}],['PartnerGuide'],['Tabs',{screen:'Search'}],['Contact']]);
 await act(async()=>tree.unmount());
});

test('all generated native marketplace explanations match current website source',()=>{assert.match(execFileSync(process.execPath,['scripts/generate-native-marketplace-guides.mjs','--check'],{cwd:new URL('../../../',import.meta.url),encoding:'utf8'}),/matches website/)});
