import { process as processMessage } from './message';
import { IpcEvents } from '../../../common/IpcEvents.enum';

export type CallAcceptedMessageWithPayload = {
  type: 'CALL_ACCEPTED';
  payload: {
    signalData: string;
  };
};

export type DeviceDetailsMessageWithPayload = {
  type: 'DEVICE_DETAILS';
  payload: {
    deviceType: string;
    os: string;
    browser: string;
    deviceScreenWidth: number;
    deviceScreenHeight: number;
  };
};

export type GetAppThemeMessageWithPayload = {
  type: 'GET_APP_THEME';
  payload: Record<string, unknown>;
};

export type GetAppLanguageMessageWithPayload = {
  type: 'GET_APP_LANGUAGE';
  payload: Record<string, unknown>;
};

export type ProcessedMessage =
  | CallAcceptedMessageWithPayload
  | DeviceDetailsMessageWithPayload
  | GetAppThemeMessageWithPayload
  | GetAppLanguageMessageWithPayload;

export function handleDeviceIPMessage(
  deviceIP: string,
  peerConnection: PeerConnection,
  message: ProcessedMessage,
): void {
  if (message.type !== 'DEVICE_DETAILS') return;
  const device = {
    id: Math.random().toString(),
    deviceIP,
    deviceType: message.payload.deviceType,
    deviceOS: message.payload.os,
    deviceBrowser: message.payload.browser,
    deviceScreenWidth: message.payload.deviceScreenWidth,
    deviceScreenHeight: message.payload.deviceScreenHeight,
    sharingSessionID: peerConnection.sharingSessionID,
    deviceRoomId: peerConnection.roomID,
  };
  peerConnection.partnerDeviceDetails = device;
  peerConnection.onDeviceConnectedCallback(device);
}

export const handleRecieveEncryptedMessage = async (
  peerConnection: PeerConnection,
  payload: ReceiveEncryptedMessagePayload,
): Promise<void> => {
  let message: ProcessedMessage;
  try {
    message = await processMessage(payload, peerConnection.user.privateKey);
  } catch (e) {
    console.error('failed to process/decrypt incoming message', e, payload);
    return;
  }
  // const message = payload as any;
  if (message.type === 'CALL_ACCEPTED') {
    peerConnection.peer.signal(message.payload.signalData);
  }
  if (message.type === 'DEVICE_DETAILS') {
    peerConnection.socket.emit('GET_IP_BY_SOCKET_ID', payload.fromSocketID, (deviceIP: string) => {
      // TODO: need to add myIP in client message.payload.myIP, then if retrieved deviceIP and myIP from client don't match, we were spoofed, then we can interrupt connection immediately!
      handleDeviceIPMessage(deviceIP, peerConnection, message);
    });
  }
  if (message.type === 'GET_APP_THEME') {
    const isDarkAppTheme = await window.electron.ipcRenderer.invoke(IpcEvents.GetIsAppDarkTheme);
    peerConnection.sendEncryptedMessage({
      type: 'APP_THEME',
      payload: {
        value: isDarkAppTheme,
      },
    });
  }
  if (message.type === 'GET_APP_LANGUAGE') {
    const appLanguage = await window.electron.ipcRenderer.invoke(IpcEvents.GetAppLanguage);
    peerConnection.sendEncryptedMessage({
      type: 'APP_LANGUAGE',
      payload: {
        value: appLanguage,
      },
    });
  }
};
