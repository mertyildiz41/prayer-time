import ReactPush from 'react-push-client';
import { Alert, Platform } from 'react-native';

// ReactPush configuration
const REACT_PUSH_API_KEY = 'tEi7p9zYCCkyx43IH-3gOf_WSr1q5_Guiv5wQFRcgyI';
const REACT_PUSH_API_URL = 'https://reactpush.com';
const APP_VERSION = '0.0.1';

let reactPushInstance: ReactPush | null = null;

export const initializeReactPush = () => {
  if (reactPushInstance) {
    return reactPushInstance;
  }

  reactPushInstance = new ReactPush({
    apiKey: REACT_PUSH_API_KEY,
    apiUrl: REACT_PUSH_API_URL,
    appVersion: APP_VERSION,
    onUpdateAvailable: (update) => {
      console.log('[ReactPush] Update available:', update);
    },
    onUpdateDownloaded: (update) => {
      console.log('[ReactPush] Update downloaded:', update);
      // Optionally prompt user to restart the app
      Alert.alert(
        'Update Available',
        'A new version has been downloaded. Restart the app to apply the update.',
        [
          {
            text: 'Later',
            style: 'cancel',
          },
          {
            text: 'Restart Now',
            onPress: () => {
              // The update will be applied on next restart
              try {
                const RNRestart = require('react-native-restart').default;
                RNRestart.restart();
              } catch (error) {
                console.error('[ReactPush] Failed to restart app:', error);
              }
            },
          },
        ],
      );
    },
    onError: (error) => {
      console.error('[ReactPush] Error:', error);
    },
  });

  return reactPushInstance;
};

export const checkForUpdates = async () => {
  const instance = initializeReactPush();
  if (instance) {
    try {
      await instance.checkForUpdate();
    } catch (error) {
      console.error('[ReactPush] Failed to check for updates:', error);
    }
  }
};

export const syncUpdates = async () => {
  const instance = initializeReactPush();
  if (instance) {
    try {
      await instance.sync({
        checkFrequency: 'ON_APP_START',
        installMode: 'ON_NEXT_RESTART',
      });
    } catch (error) {
      console.error('[ReactPush] Failed to sync updates:', error);
    }
  }
};

export const getReactPushInstance = () => {
  return reactPushInstance;
};

export default {
  initializeReactPush,
  checkForUpdates,
  syncUpdates,
  getReactPushInstance,
};

