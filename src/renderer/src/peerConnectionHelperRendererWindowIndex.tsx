import { IpcEvents } from '../../common/IpcEvents.enum';
import PeerConnection from './features/PeerConnection';

const loadDevelopmentText = (): void => {
  const root = document.getElementById('root');
  if (root) {
    const h1 = document.createElement('h1');
    h1.textContent = 'This is a client connection WebRTC electron renderer helper window.';
    root.appendChild(h1);

    const h2Mode = document.createElement('h2');
    h2Mode.textContent = 'It is shown only in Dev mode';
    root.appendChild(h2Mode);

    const h2F12 = document.createElement('h2');
    h2F12.textContent =
      'Press F12 to open Development Tools for this renderer window to debug webrtc with one connected client.';
    root.appendChild(h2F12);
  } else {
    console.error('Root element not found.');
  }
};

export function handleIpcRenderer(): void {
  window.electron.ipcRenderer.on('start-peer-connection', () => {
    let peerConnection: PeerConnection;

    window.electron.ipcRenderer.on('create-peer-connection-with-data', async (_, data) => {
      const port = await window.electron.ipcRenderer.invoke(IpcEvents.GetPort);
      peerConnection = new PeerConnection(data.roomID, data.sharingSessionID, data.user, port);

      peerConnection.setOnDeviceConnectedCallback((deviceData) => {
        window.electron.ipcRenderer.send('peer-connected', deviceData);
      });
    });

    window.electron.ipcRenderer.on('set-desktop-capturer-source-id', (_, id) => {
      peerConnection.setDesktopCapturerSourceID(id);
    });

    window.electron.ipcRenderer.on('call-peer', () => {
      peerConnection.callPeer();
    });

    window.electron.ipcRenderer.on('disconnect-by-host-machine-user', (_, deviceId: string) => {
      peerConnection.disconnectByHostMachineUser(deviceId);
    });

    window.electron.ipcRenderer.on('deny-connection-for-partner', () => {
      peerConnection.denyConnectionForPartner();
    });

    window.electron.ipcRenderer.on('send-user-allowed-to-connect', () => {
      peerConnection.sendUserAllowedToConnect();
    });

    window.electron.ipcRenderer.on('app-color-theme-changed', () => {
      peerConnection.notifyClientWithNewColorTheme();
    });

    window.electron.ipcRenderer.on('app-language-changed', () => {
      peerConnection.notifyClientWithNewLanguage();
    });
  });
}

handleIpcRenderer();

loadDevelopmentText();
