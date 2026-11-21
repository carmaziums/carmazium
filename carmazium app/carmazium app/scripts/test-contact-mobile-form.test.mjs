import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
async function mount(openURL){
 const modules={react:React,'react-native':{View:'View',Text:'Text',ScrollView:'ScrollView',StatusBar:'StatusBar',TouchableOpacity:'TouchableOpacity',StyleSheet:{create:s=>s},Linking:{openURL},Alert:{alert:()=>{}}},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},'expo-linear-gradient':{LinearGradient:'Gradient'},'@/components/BrandIcon':{Ionicons:'Icon'},'@react-navigation/native':{useNavigation:()=>({})},'../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{},FontSize:{}},'../../constants/spacing':{Elevation:{},Radius:{}},'../../components/IconButton':{IconButton:'IconButton'},'../../components/WebsiteTopBar':{WebsiteTopBar:'Header'},'../../components/NativePage':{FormField:'FormField',pageStyles:{}},'../../components/Button':{Button:'Button'}};
 const exports={};runInNewContext(ts.transpileModule(readFileSync(new URL('../src/screens/main/ContactScreen.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in modules))throw Error(n);return modules[n];}});
 let tree;await act(async()=>{tree=create(React.createElement(exports.ContactScreen));});return tree;
}
const fill=async(t,label,value)=>act(async()=>t.root.findAllByType('FormField').find(n=>n.props.label===label).props.onChangeText(value));
const click=t=>act(async()=>t.root.findByType('Button').props.onPress());
test('contact requires complete valid fields and only opens an encoded draft after explicit action',async()=>{
 const opened=[];const t=await mount(async url=>opened.push(url));await click(t);assert.equal(opened.length,0);
 for(const [label,value]of [['Full Name','Test User'],['Email Address','invalid'],['Subject','Price & details'],['Message','Line one\nLine two']])await fill(t,label,value);
 await click(t);assert.equal(opened.length,0);await fill(t,'Email Address','test@example.com');assert.equal(opened.length,0);await click(t);
 assert.equal(opened.length,1);const url=new URL(opened[0]);assert.equal(url.protocol,'mailto:');assert.equal(url.pathname,'info@carmazium.com');assert.equal(url.searchParams.get('subject'),'CarMazium enquiry: Price & details');assert.equal(url.searchParams.get('body'),'Name: Test User\nReply-to email: test@example.com\n\nMessage:\nLine one\nLine two');await act(async()=>t.unmount());
});
test('missing email app keeps entered fields and explains that nothing was sent',async()=>{
 const t=await mount(async()=>{throw Error('no mail app');});for(const [label,value]of [['Full Name','Test'],['Email Address','test@example.com'],['Subject','Question'],['Message','Please help']])await fill(t,label,value);await click(t);
 assert.match(t.root.findAllByType('Text').find(n=>n.props.accessibilityRole==='alert').props.children,/has not been sent/);assert.equal(t.root.findAllByType('FormField').find(n=>n.props.label==='Message').props.value,'Please help');await act(async()=>t.unmount());
});
