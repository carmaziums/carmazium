import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const source = readFileSync(new URL('../src/screens/main/DealerOnboardingScreen.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React,
  esModuleInterop: true, target: ts.ScriptTarget.ES2022,
}}).outputText;

async function mount({account = {role:'DEALER', dealerProfile:{companyName:'Saved Motors'}},
  provider = null, isVerified = false, accountRole = 'dealer'} = {}) {
  const nav=[], writes=[], roles=[], lookups=[];
  const navigation = {
    navigate:(...args)=>nav.push(['navigate',...args]),
    replace:(...args)=>nav.push(['replace',...args]),
    goBack:()=>nav.push(['back']),
  };
  const auth = {
    user:{id:'synthetic-user',isVerified}, role:'dealer', accountRole,
    initializeAuth: async()=>lookups.push('initializeAuth'),
    setRole:value=>roles.push(value),
  };
  const modules = {
    react: React,
    'react-native': {
      View:'View', Text:'Text', TouchableOpacity:'Press', ScrollView:'ScrollView',
      StatusBar:'StatusBar', TextInput:'TextInput', ActivityIndicator:'ActivityIndicator',
      Switch:'Switch', StyleSheet:{create:value=>value,absoluteFillObject:{}},
    },
    '@/components/BrandIcon':{Ionicons:'Icon', MaterialCommunityIcons:'Icon'},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},
    'expo-linear-gradient':{LinearGradient:'Gradient'},
    '../../constants/typography':{FontFamily:{},FontSize:{}},
    '../../constants/spacing':{Radius:{}},
    '../../lib/apiClient':{apiClient:async(path,options)=>{writes.push({path,options});return {data:{}};}},
    '../../lib/servicesApi':{
      getPartnerProfile: async()=>{lookups.push('profile');if(account instanceof Error) throw account;return account;},
      getMyCapabilities: async()=>{lookups.push('capabilities');return {profile:provider};},
    },
    '../../store/authStore':{useAuthStore:()=>auth},
    '../../components/GlobalToastProvider':{GlobalToastContext:React.createContext({showToast(){}})},
    '../../components/Button':{Button:'Button'},
    '../../components/ui/ErrorBanner':{ErrorBanner:'ErrorBanner'},
    '../../components/KeyboardStickyView':{KeyboardStickyView:'KeyboardStickyView'},
    '../../constants/colors':{Colors:{},themeStatusBarStyle:'dark-content'},
    '../../components/IconButton':{IconButton:'IconButton'},
  };
  const exports={};
  runInNewContext(code,{exports,require:n=>{assert.ok(n in modules,n);return modules[n];}});
  let tree;
  await act(async()=>{tree=create(React.createElement(exports.DealerOnboardingScreen,{navigation}));});
  return {tree,nav,writes,roles,lookups,unmount:()=>act(async()=>tree.unmount())};
}
const text=tree=>tree.root.findAllByType('Text').map(t=>t.children.join('')).join('|');

test('returning unverified dealer resumes saved KYC, never recreates dealer profile',async()=>{
  const h=await mount();
  assert.deepEqual(h.nav,[['replace','DealerKYC']]);
  assert.deepEqual(h.writes,[]);
  assert.deepEqual(h.roles,['dealer']);
  await h.unmount();
});

test('dealer with a preserved profile and a switched role reuses it, only re-elevating',async()=>{
  const h=await mount({account:{role:'BUYER',dealerProfile:{companyName:'Saved Motors'}},accountRole:'buyer'});
  assert.deepEqual(h.nav,[['replace','DealerKYC']]);
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].path,'/users/elevate');
  assert.deepEqual(JSON.parse(h.writes[0].options.body),{newRole:'DEALER'});
  await h.unmount();
});

test('returning service provider sees real saved trading details, with no invented VAT or registration',async()=>{
  const h=await mount({account:{role:'CONTRACTOR',dealerProfile:null},
    provider:{businessName:'Saved Services',phone:'07700900111',serviceArea:'Birmingham'}});
  assert.deepEqual(h.nav,[]);
  assert.deepEqual(h.writes,[]);
  const inputs=h.tree.root.findAllByType('TextInput').map(t=>t.props.value);
  for(const value of ['Saved Services','07700900111']) assert.ok(inputs.includes(value),value);
  assert.ok(!inputs.includes('Birmingham'), 'coverage area is not the registered business address');
  assert.ok(inputs.includes(''), 'business-specific fields must not be invented');
  await h.unmount();
});

test('brand-new user receives the existing first-time form without writes',async()=>{
  const h=await mount({account:{role:'DEALER',dealerProfile:null}});
  assert.match(text(h.tree),/Set up your dealership/);
  assert.deepEqual(h.nav,[]);
  assert.deepEqual(h.writes,[]);
  await h.unmount();
});

test('failed saved-profile lookup blocks duplicate creation and offers retry',async()=>{
  const h=await mount({account:new Error('offline')});
  assert.match(text(h.tree),/offline/);
  assert.ok(h.tree.root.findAllByType('Button').some(x=>x.props.label==='Retry account check'));
  assert.equal(h.tree.root.findAllByType('KeyboardStickyView').length,0);
  assert.deepEqual(h.writes,[]);
  await h.unmount();
});
