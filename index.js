import * as THREE from 'three';
import Simplex from './simplex-noise.js';
import metaversefile from 'metaversefile';
const {useFrame, useApp} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const localVector = new THREE.Vector3();
const simplex = new Simplex('lol');

export default () => {
  const app = useApp();

  let subApp = null;
  (async () => {
    subApp = await metaversefile.load(baseUrl + '/megasword_v4_texta.glb');
    app.add(subApp);
  })();

  app.getPhysicsObjects = () => subApp ? subApp.getPhysicsObjects() : [];

  return app;
};