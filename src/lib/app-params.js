const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

export const appParams = {
  appName: 'wms-local',
  version: 'local'
};

