import * as THREE from 'three';
// import Simplex from './simplex-noise.js';
import metaversefile from 'metaversefile';
const {useApp, useLocalPlayer, useActivate, useWear, useScene, getNextInstanceId} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

export default () => {
  const app = useApp();
  const scene = useScene();

  /* const components = [
    {
      "key": "physics",
      "value": true
    },
    {
      "key": "animation",
      "value": false
    },
    {
      "key": "wear",
      "value": {
        "boneAttachment": "spine",
        "position": [-0.3, 0.7, -0.15],
        "quaternion": [0, 0, 0.9510565162951536, -0.30901699437494734]
      }
    },
    {
      "key": "use",
      "value": {
        "animation": [
          "swordSideSlash",
          "swordSideSlash"
        ],
        "boneAttachment": "leftHand",
        "position": [-0.07, -0.03, 0],
        "quaternion": [0.7071067811865475, 0, 0, 0.7071067811865476],
        "scale": [1, 1, 1]
      }
    },
    {
      "key": "aim",
      "value": {
        "animation": "swordSide",
      },
    }
  ]; */
  // console.log('got app components', app.components);
  const {components} = app;

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
    subApp.contentId = u2;
    subApp.instanceId = app.instanceId;
    // subApp.instanceId = getNextInstanceId();

    // subApp.setComponent('physics', true);
    for (const {key, value} of components) {
      subApp.setComponent(key, value);
    }
    await subApp.addModule(m);
    scene.add(subApp);

    // metaversefile.addApp(subApp);
    // window.subApp = subApp;

    // app.add(subApp);
  })();

  useActivate(() => {
    const localPlayer = useLocalPlayer();
    localPlayer.wear(app);
  });

  useWear(e => {
    const {wear} = e;
    // for (const subApp of subApps) {
    console.log('wear', subApp, wear);
    if (subApp) {
      subApp.dispatchEvent({
        type: 'wearupdate',
        wear,
      });
    }
    // }
    // wearing = wear;
  });

  app.getPhysicsObjects = () => {
    const result = subApp ? subApp.getPhysicsObjects() : [];
    // console.log('get physics objects', subApp, result);
    return result;
  };

  return app;
};