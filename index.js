import * as THREE from 'three';
// import Simplex from './simplex-noise.js';
import metaversefile from 'metaversefile';
const {useApp, useLocalPlayer, useActivate, useWear, useScene, getNextInstanceId} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

export default () => {
  const app = useApp();
  const scene = useScene();
  
  const {components} = app;

  let subApp = null;
  (async () => {
    const u2 = baseUrl + 'megasword_v4_texta.glb';
    const m = await metaversefile.import(u2);

    subApp = metaversefile.createApp({
      name: u2,
    });
    subApp.position.copy(app.position);
    subApp.quaternion.copy(app.quaternion);
    subApp.scale.copy(app.scale);
    subApp.updateMatrixWorld();
    subApp.contentId = u2;
    subApp.instanceId = app.instanceId;

    for (const {key, value} of components) {
      subApp.setComponent(key, value);
    }
    await subApp.addModule(m);
    scene.add(subApp);
  })();

  useActivate(() => {
    const localPlayer = useLocalPlayer();
    localPlayer.wear(app);
  });

  useWear(e => {
    const {wear} = e;
    if (subApp) {
      subApp.dispatchEvent({
        type: 'wearupdate',
        wear,
      });
    }
  });

  app.getPhysicsObjects = () => {
    const result = subApp ? subApp.getPhysicsObjects() : [];
    return result;
  };

  return app;
};