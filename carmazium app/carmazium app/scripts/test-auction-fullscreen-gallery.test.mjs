import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
function load(source, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  runInNewContext(code, { exports, requestAnimationFrame: setImmediate, cancelAnimationFrame: clearImmediate,
    require: name => { assert.ok(name in modules, name); return modules[name]; } });
  return exports;
}
let viewport = { width: 390, height: 844, fontScale: 1 };
const rn = { Modal: 'Modal', View: 'View', Text: 'Text', FlatList: 'FlatList',
  useWindowDimensions: () => viewport, StyleSheet: { create: value => value } };
const modules = {
  react: React, 'react-native': rn, 'expo-image': { Image: 'Image' },
  '@/components/BrandIcon': { Ionicons: 'Icon' }, './IconButton': { IconButton: 'IconButton' },
  '../constants/colors': { Colors: {} }, '../constants/typography': { FontFamily: {}, FontSize: {} },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
  '../lib/fullscreenGalleryNavigation': load(read('../src/lib/fullscreenGalleryNavigation.ts')),
  '../lib/vehicleImagePresentation': load(read('../src/lib/vehicleImagePresentation.ts')),
};
const { ImageLightbox } = load(read('../src/components/ImageLightbox.tsx'), modules);
const images = Array.from({ length: 10 }, (_, i) => `https://example.test/${i}.jpg`);
const counter = tree => tree.root.findByType('Text').children.join('');

test('full-screen photos start at the tapped image, swipe, notify the inline gallery and close', async () => {
  let tree; const selected = []; let closed = 0;
  await act(async () => { tree = create(React.createElement(ImageLightbox, {
    visible: true, images, initialIndex: 6, onIndexChange: i => selected.push(i), onClose: () => closed++,
  })); });
  assert.equal(tree.root.findByType('Modal').props.presentationStyle, 'overFullScreen');
  assert.equal(tree.root.findByType('FlatList').props.initialScrollIndex, 6);
  assert.equal(counter(tree), '7 / 10');
  await act(async () => tree.root.findByType('FlatList').props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 9 * 390 } } }));
  assert.equal(counter(tree), '10 / 10'); assert.deepEqual(selected, [9]);
  tree.root.findByType('Modal').props.onRequestClose();
  tree.root.findByType('IconButton').props.onPress(); assert.equal(closed, 2);
  const page = tree.root.findByType('FlatList').props.renderItem({ item: images[0] + '#cm-photo=cover,25,75,2,EXTERIOR' });
  assert.equal(page.props.children.props.source.uri, images[0]);
  assert.equal(page.props.children.props.contentFit, 'contain');
  await act(async () => tree.unmount());
});

test('rotation preserves selection and reopening or changed photo counts cannot show a missing image', async () => {
  let tree; const props = { visible: true, images, initialIndex: 1, onClose() {} };
  await act(async () => { tree = create(React.createElement(ImageLightbox, props)); });
  await act(async () => tree.root.findByType('FlatList').props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 4 * 390 } } }));
  viewport = { width: 844, height: 390, fontScale: 1.3 };
  await act(async () => tree.update(React.createElement(ImageLightbox, props)));
  assert.equal(counter(tree), '5 / 10');
  assert.equal(tree.root.findByType('FlatList').props.getItemLayout(null, 4).offset, 3376);
  await act(async () => tree.update(React.createElement(ImageLightbox, { ...props, visible: false })));
  await act(async () => tree.update(React.createElement(ImageLightbox, { ...props, initialIndex: 99, images: images.slice(0, 3) })));
  assert.equal(counter(tree), '3 / 3');
  assert.equal(tree.root.findByType('FlatList').props.initialScrollIndex, 2);
  await act(async () => tree.update(React.createElement(ImageLightbox, { ...props, images: [] })));
  assert.equal(tree.toJSON(), null);
  await act(async () => tree.unmount()); viewport = { width: 390, height: 844, fontScale: 1 };
});

test('actual auction gallery bindings open the tapped photo and keep thumbnails in sync after swiping', async () => {
  const source = read('../src/screens/vehicle/AuctionDetailScreen.tsx');
  const ast = ts.createSourceFile('AuctionDetailScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements = {};
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && ['ImageCarousel', 'ImageLightbox'].includes(node.tagName.getText(ast))) {
      elements[node.tagName.getText(ast)] = node.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(elements.ImageCarousel && elements.ImageLightbox);
  const { Harness } = load(`import React, {useState} from 'react';
    import {ImageCarousel, ImageLightbox} from 'components';
    export function Harness({photoGallery}) {
      const [activePhotoIndex,setActivePhotoIndex]=useState(0);
      const [lightboxPhotoIndex,setLightboxPhotoIndex]=useState(null);
      const heroWidth=390; const image='';
      return <>${elements.ImageCarousel}${elements.ImageLightbox}</>;
    }`, { react: React, components: { ImageCarousel: 'Carousel', ImageLightbox: 'Lightbox' } });
  let tree;
  await act(async () => { tree = create(React.createElement(Harness, { photoGallery: images })); });
  assert.equal(tree.root.findByType('Lightbox').props.visible, false);
  await act(async () => tree.root.findByType('Carousel').props.onPress(7));
  assert.equal(tree.root.findByType('Lightbox').props.initialIndex, 7);
  assert.equal(tree.root.findByType('Lightbox').props.visible, true);
  await act(async () => tree.root.findByType('Lightbox').props.onIndexChange(9));
  assert.equal(tree.root.findByType('Carousel').props.activeIndex, 9);
  assert.equal(tree.root.findByType('Lightbox').props.initialIndex, 7, 'swiping must not reopen the viewer');
  await act(async () => tree.root.findByType('Lightbox').props.onClose());
  assert.equal(tree.root.findByType('Lightbox').props.visible, false);
  await act(async () => tree.unmount());
});
test('live and upcoming auction card photos open the selected photo without entering a bid screen', async () => {
  const source = read('../src/screens/main/LiveScreen.tsx');
  const ast = ts.createSourceFile('LiveScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const carousels = []; let lightbox;
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(ast) === 'ImageCarousel') carousels.push(node.getText(ast));
      if (node.tagName.getText(ast) === 'ImageLightbox') lightbox = node.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(carousels.length, 2); assert.ok(lightbox);
  const { Harness } = load(`import React, {useState} from 'react';
    import {ImageCarousel,ImageLightbox} from 'components';
    export function Harness({images}) {
      const [photoViewer,setPhotoViewer]=useState(null);
      const auction={images},auc={listing:{images}},SCREEN_WIDTH=390;
      return <>${carousels.join('')}${lightbox}</>;
    }`, { react: React, components: { ImageCarousel: 'Carousel', ImageLightbox: 'Lightbox' } });
  let tree; await act(async () => { tree = create(React.createElement(Harness, { images })); });
  for (const [card, index] of [[0, 4], [1, 8]]) {
    await act(async () => tree.root.findAllByType('Carousel')[card].props.onPress(index));
    assert.equal(tree.root.findByType('Lightbox').props.visible, true);
    assert.equal(tree.root.findByType('Lightbox').props.initialIndex, index);
    assert.deepEqual(tree.root.findByType('Lightbox').props.images, images);
    await act(async () => tree.root.findByType('Lightbox').props.onClose());
  }
  await act(async () => tree.unmount());
});