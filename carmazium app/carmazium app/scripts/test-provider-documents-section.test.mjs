import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const source = readFileSync(new URL('../src/components/tradexchange/ProviderDocumentsSection.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const requirement=(state='MISSING')=>({
 type:'DELIVERY_BUSINESS_INSURANCE',title:'Trade insurance',description:'Collection and delivery cover',
 expiryRequired:true,optional:false,state,currentEvidenceId:null,approvedEvidenceId:null,evidenceExpiresAt:null,
});
const cap=type=>({id:'cap-'+type,serviceType:type,status:'PENDING'});
const detail=(type='DELIVERY',state='MISSING',attachments=[])=>({
 capabilityId:'cap-'+type,serviceType:type,verification:{
  verificationStatus:'IN_REVIEW',requirements:type==='DELIVERY'?[requirement(state)]:[],
  declarationRequired:true,declarationCurrent:true,
 },attachments
});
const allCaps=[cap('DELIVERY'),cap('INSPECTION')];
const text=tree=>tree.root.findAllByType('Text').map(x=>x.children.join('')).join('|');
async function render({capabilities=allCaps,details={DELIVERY:detail('DELIVERY'),INSPECTION:detail('INSPECTION')},uploadError}={}){
  const calls=[], opened=[];
  const modules={
    react:React,
    'react-native':{
      View:'View',Text:'Text',TextInput:'Input',TouchableOpacity:'Press',ActivityIndicator:'Spinner',
      StyleSheet:{create:x=>x},Alert:{alert:(...args)=>calls.push(['alert',args])},
      Linking:{openURL:async url=>opened.push(url)},
    },
    'expo-document-picker':{getDocumentAsync:async()=>({canceled:false,assets:[{uri:'file:///private.pdf',name:'insurance.pdf',mimeType:'application/pdf',size:345}]})},
    '../Button':{Button:'Button'},
    '../../constants/colors':{Colors:{},},
    '../../constants/typography':{FontFamily:{}},
    '../../lib/servicesApi':{},
    '../../lib/serviceOperationsApi':{
      getCapabilityVerification:async id=>{
        calls.push(['get',id]);const type=id.slice(4);
        if(!(type in details))throw Error('Missing service verification');
        return details[type];
      },
      uploadCapabilityAttachment:async(id,file,body)=>{
        calls.push(['upload',id,file,body]);
        if(uploadError) throw Error(uploadError);
      },
      deleteCapabilityAttachment:async(id,entry)=>calls.push(['delete',id,entry])
    },
  };
  const exports={};
  runInNewContext(code,{exports,require:n=>{assert.ok(n in modules,'Module '+n);return modules[n];},Error,Date,RegExp});
  let tree;
  await act(async()=>{tree=create(React.createElement(exports.ProviderDocumentsSection,{capabilities}));});
  const press=async(label)=>act(async()=>{
    const node=tree.root.findAllByType('Press').find(n=>n.props.accessibilityLabel===label);
    assert.ok(node,'Press '+label);
    return node.props.onPress();
  });
  const click=async(label)=>act(async()=>{
    const node=tree.root.findAllByType('Button').find(n=>n.props.label===label);
    assert.ok(node,'Button '+label);
    return node.props.onPress();
  });
  const input=async(label,value)=>act(async()=>{
    const node=tree.root.findAllByType('Input').find(n=>n.props.accessibilityLabel===label);
    assert.ok(node,'Input '+label);
    node.props.onChangeText(value);
  });
  return {tree,calls,opened,press,click,input,unmount:()=>act(async()=>tree.unmount())};
}

test('document section is collapsed by default and never downloads private evidence unnecessarily',async()=>{
 const h=await render();
 assert.match(text(h.tree),/Documents & Insurance/);
 assert.equal(h.calls.length,0);
 await h.unmount();
});

test('inspection does not request uploads even if historical inspection documents exist',async()=>{
 const old={id:'old-inspection',evidenceStatus:'APPROVED',label:'Historical inspection liability',createdAt:'2026-09-01',url:'https://example.invalid/limited-signed-url'};
 const h=await render({details:{DELIVERY:detail('DELIVERY'),INSPECTION:detail('INSPECTION','SATISFIED',[old])}});
 await h.press('Documents & Insurance');
 await h.click('Inspection');
 assert.match(text(h.tree),/No inspection documents required/);
 assert.ok(!h.tree.root.findAllByType('Button').some(n=>/Upload for review|Upload trade insurance/.test(n.props.label||'')));
 await h.click('Show document history (1)');
 assert.match(text(h.tree),/Historical inspection liability/);
 assert.equal(h.calls.filter(c=>c[0]==='upload').length,0);
 await h.unmount();
});

test('delivery uploads only current trade insurance via the existing API with expiry and review',async()=>{
 const h=await render();
 await h.press('Documents & Insurance');
 assert.match(text(h.tree),/Missing or expired/);
 await h.click('Upload trade insurance');
 await h.click('Choose PDF or image (max 10 MB)');
 await h.input('Expiry date','2030-11-22');
 await h.click('Upload for review');
 const upload=h.calls.find(c=>c[0]==='upload');
 assert.ok(upload);
 assert.equal(upload[1],'cap-DELIVERY');
 assert.equal(upload[3].evidenceType,'DELIVERY_BUSINESS_INSURANCE');
 assert.equal(upload[3].expiresAt,'2030-11-22');
 assert.equal(h.calls.filter(c=>c[0]==='get').length,2);
 await h.unmount();
});

test('upload failures display errors, without clearing existing documents or approvals',async()=>{
 const h=await render({uploadError:'storage offline'});
 await h.press('Documents & Insurance');
 await h.click('Upload trade insurance');
 await h.click('Choose PDF or image (max 10 MB)');
 await h.input('Expiry date','2030-11-22');
 await h.click('Upload for review');
 assert.match(text(h.tree),/storage offline/);
 assert.equal(h.calls.filter(c=>c[0]==='upload').length,1);
 await h.unmount();
});

test('no application means no provider upload request',async()=>{
 const h=await render({capabilities:[]});
 await h.press('Documents & Insurance');
 assert.match(text(h.tree),/No collection\/delivery application yet/);
 assert.equal(h.calls.length,0);
 await h.unmount();
});

test('only pending historical evidence can be deleted after confirmation',async()=>{
 const approved={id:'approved-doc',evidenceStatus:'APPROVED',label:'Approved old insurance',createdAt:'2026-11-01',url:'https://example.invalid/signed'};
 const pending={id:'pending-doc',evidenceStatus:'PENDING',label:'Pending replacement',createdAt:'2026-11-02',url:'https://example.invalid/signed'};
 const h=await render({details:{DELIVERY:detail('DELIVERY','PENDING',[approved,pending]),INSPECTION:detail('INSPECTION')}});
 await h.press('Documents & Insurance');
 await h.click('Show document history (2)');
 assert.equal(h.tree.root.findAllByType('Button').filter(n=>n.props.label==='Delete pending document').length,1);
 await h.click('Delete pending document');
 const alert=h.calls.find(c=>c[0]==='alert');
 assert.ok(alert,'must ask for explicit confirmation');
 const destructive=alert[1][2].find(item=>item.text==='Delete');
 await act(async()=>destructive.onPress());
 assert.deepEqual(h.calls.filter(c=>c[0]==='delete'),[['delete','cap-DELIVERY','pending-doc']]);
 await h.unmount();
});
