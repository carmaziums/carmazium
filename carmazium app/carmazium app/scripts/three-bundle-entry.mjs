// Regenerate src/assets/3d/three-bundle.txt after changing the pinned three
// version here: from this directory, run
//   npm install --no-save --legacy-peer-deps three@0.169.0
//   npx esbuild scripts/three-bundle-entry.mjs --bundle --minify --format=iife --outfile=src/assets/3d/three-bundle.txt
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

window.__CARMAZIUM_THREE__ = { THREE, GLTFLoader, OrbitControls };
