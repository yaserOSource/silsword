import * as THREE from 'three';
// import Simplex from './simplex-noise.js';
import metaversefile from 'metaversefile';
const {useApp, useScene} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

export default () => {
  const app = useApp();
  const scene = useScene();

  let subApp = null;
  (async () => {
    const u2 = baseUrl + '/megasword_v4_texta.glb';
    const m = await metaversefile.import(u2);

    subApp = metaversefile.createApp({
      name: u2,
    });
    subApp.position.copy(app.position);
    subApp.quaternion.copy(app.quaternion);
    subApp.scale.copy(app.scale);
    subApp.updateMatrixWorld();
    // subApp.instanceId = getNextInstanceId();
    subApp.contentId = u2;
    subApp.setComponent('physics', true);
    /* for (const {key, value} of components) {
      subApp.setComponent(key, value);
    } */
    await subApp.addModule(m);
    scene.add(subApp);

    // metaversefile.addApp(subApp);
    // window.subApp = subApp;

    // app.add(subApp);
  })();

  app.getPhysicsObjects = () => {
    const result = subApp ? subApp.getPhysicsObjects() : [];
    // console.log('get physics objects', subApp, result);
    return result;
  };

  return app;
};