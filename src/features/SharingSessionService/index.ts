import uuid from 'uuid';
import RoomIDService from '../../server/RoomIDService';
import { ConnectedDevicesService } from '../ConnectedDevicesService';
import RendererWebrtcHelpersService from '../PeerConnectionHelperRendererService';
import SharingSession from './SharingSession';
import SharingSessionStatusEnum from './SharingSessionStatusEnum';
import DeskreenCrypto from '../../main/utils/crypto';
import { LocalPeerUser } from '../../common/LocalPeerUser';

export default class SharingSessionService {
  crypto: DeskreenCrypto;
  user: LocalPeerUser | null;
  sharingSessions: Map<string, SharingSession>;
  waitingForConnectionSharingSession: SharingSession | null;
  roomIDService: RoomIDService;
  connectedDevicesService: ConnectedDevicesService;
  rendererWebrtcHelpersService: RendererWebrtcHelpersService;
  isCreatingNewSharingSession: boolean;

  constructor(
    _roomIDService: RoomIDService,
    _connectedDevicesService: ConnectedDevicesService,
    _rendererWebrtcHelpersService: RendererWebrtcHelpersService,
  ) {
    this.roomIDService = _roomIDService;
    this.connectedDevicesService = _connectedDevicesService;
    this.rendererWebrtcHelpersService = _rendererWebrtcHelpersService;
    this.crypto = new DeskreenCrypto();
    this.waitingForConnectionSharingSession = null;
    this.sharingSessions = new Map<string, SharingSession>();
    this.user = null;
    this.isCreatingNewSharingSession = false;
    this.createUser();

    setInterval(
      () => {
        this.pollForInactiveSessions();
      },
      1000 * 60 * 60,
    ); // every hour
  }

  createUser(): Promise<undefined> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      if (process.env.RUN_MODE === 'test') resolve(undefined);
      const username = uuid.v4();

      const encryptDecryptKeys = await this.crypto.createEncryptDecryptKeys();
      const exportedEncryptDecryptPrivateKey = await this.crypto.exportKey(
        encryptDecryptKeys.privateKey,
      );
      const exportedEncryptDecryptPublicKey = await this.crypto.exportKey(
        encryptDecryptKeys.publicKey,
      );

      this.user = {
        username,
        privateKey: exportedEncryptDecryptPrivateKey,
        publicKey: exportedEncryptDecryptPublicKey,
      };
      resolve(undefined);
    });
  }

  // TODO: invoike this when got user ID from browser
  createWaitingForConnectionSharingSession(roomID?: string): Promise<SharingSession> {
    if (this.isCreatingNewSharingSession) {
      return new Promise<SharingSession>((resolve, reject) => {
        const intervalId = setInterval(() => {
          if (!this.isCreatingNewSharingSession) {
            clearInterval(intervalId);
            if (this.waitingForConnectionSharingSession) {
              resolve(this.waitingForConnectionSharingSession);
            } else {
              reject(new Error('waiting sharing session is not available after creation.'));
            }
          }
        }, 50);
      });
    }

		if (!this.connectedDevicesService.isSlotAvailable()) {
			return Promise.reject(new Error('unable to create waiting session while a device is connected'));
		}

    this.isCreatingNewSharingSession = true;

    return new Promise<SharingSession>((resolve, reject) => {
      return this.waitWhileUserIsNotCreated()
        .then(async () => {
          if (this.waitingForConnectionSharingSession !== null) {
            this.isCreatingNewSharingSession = false;
            resolve(this.waitingForConnectionSharingSession);
            return this.waitingForConnectionSharingSession;
          }

          const newSession = await this.createNewSharingSession(roomID || '');
          this.waitingForConnectionSharingSession = newSession;
          this.isCreatingNewSharingSession = false;
          resolve(newSession);
          return newSession;
        })
        .catch((error) => {
          this.isCreatingNewSharingSession = false;
          reject(error);
        });
    });
  }

  async createNewSharingSession(_roomID: string): Promise<SharingSession> {
    const roomID = _roomID || (await this.roomIDService.getSimpleAvailableRoomID());
    this.roomIDService.markRoomIDAsTaken(roomID);
    const sharingSession = new SharingSession(
      roomID,
      this.user as LocalPeerUser,
      this.rendererWebrtcHelpersService,
    );
    this.sharingSessions.set(sharingSession.id, sharingSession);
    return sharingSession;
  }

  pollForInactiveSessions(): void {
    [...this.sharingSessions.keys()].forEach((key) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { status } = this.sharingSessions.get(key);
      if (
        status === SharingSessionStatusEnum.ERROR ||
        status === SharingSessionStatusEnum.DESTROYED
      ) {
        this.sharingSessions.delete(key);
      }
    });
  }

  waitWhileUserIsNotCreated(): Promise<undefined> {
    return new Promise((resolve) => {
      const currentInterval = setInterval(() => {
        if (this.user !== null) {
          resolve(undefined);
          clearInterval(currentInterval);
        }
      }, 1000);
    });
  }
}
