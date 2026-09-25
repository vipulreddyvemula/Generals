import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import GameRecord from '../src/lib/game-record';
import {
  AzureBlobReplayStorage,
  LocalReplayStorage,
  ReplayContainerClient,
  azureReplayObjectKey,
  createReplayStorageFromEnvironment,
} from '../src/lib/replay-storage';

const MATCH_ID = '76fca46d-350e-4d5b-9912-bf0023a7855f';
const REPLAY_JSON = JSON.stringify({ players: [], mapWidth: 8, mapHeight: 8, messagesRecord: [], gameRecordTurns: [], truncated: false });

describe('replay storage', () => {
  const tmpDir = path.join(os.tmpdir(), `replay-storage-${process.pid}`);

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('preserves the existing replay JSON field order and format', () => {
    const record = new GameRecord([], 8, 8);
    expect(record.serialize()).toBe(REPLAY_JSON);
  });

  it('writes and reads local replay JSON without changing its contents', async () => {
    const storage = new LocalReplayStorage(tmpDir);
    const reference = await storage.saveReplay(MATCH_ID, REPLAY_JSON);

    expect(reference).toEqual({
      replayId: MATCH_ID,
      storageType: 'LOCAL_FILESYSTEM',
      objectKey: `records/${MATCH_ID}.json`,
    });
    expect(fs.readFileSync(path.join(tmpDir, reference.objectKey), 'utf8')).toBe(REPLAY_JSON);
    await expect(storage.readReplay(reference.objectKey)).resolves.toBe(REPLAY_JSON);
  });

  it('uses the stable Azure blob name replays/<matchId>.json', () => {
    expect(azureReplayObjectKey(MATCH_ID)).toBe(`replays/${MATCH_ID}.json`);
  });

  it('uploads and downloads replay JSON through a mocked private Blob client', async () => {
    const upload = jest.fn(async () => ({}));
    const download = jest.fn(async () => ({ readableStreamBody: Readable.from([REPLAY_JSON]) }));
    const containerClient: ReplayContainerClient = {
      getBlockBlobClient: jest.fn(() => ({ upload })),
      getBlobClient: jest.fn(() => ({ download })),
    };
    const storage = new AzureBlobReplayStorage({
      accountName: 'generalsstorage',
      containerName: 'private-replays',
      containerClient,
    });

    const reference = await storage.saveReplay(MATCH_ID, REPLAY_JSON);
    expect(reference).toEqual({
      replayId: MATCH_ID,
      storageType: 'AZURE_BLOB',
      objectKey: `replays/${MATCH_ID}.json`,
    });
    expect(containerClient.getBlockBlobClient).toHaveBeenCalledWith(`replays/${MATCH_ID}.json`);
    expect(upload).toHaveBeenCalledWith(REPLAY_JSON, Buffer.byteLength(REPLAY_JSON), {
      blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
    });
    await expect(storage.readReplay(reference.objectKey)).resolves.toBe(REPLAY_JSON);
  });

  it('propagates upload failures so existing replay telemetry can record them', async () => {
    const uploadError = new Error('blob upload failed');
    const containerClient: ReplayContainerClient = {
      getBlockBlobClient: jest.fn(() => ({ upload: jest.fn(async () => { throw uploadError; }) })),
      getBlobClient: jest.fn(),
    };
    const storage = new AzureBlobReplayStorage({
      accountName: 'generalsstorage',
      containerName: 'private-replays',
      containerClient,
    });

    await expect(storage.saveReplay(MATCH_ID, REPLAY_JSON)).rejects.toBe(uploadError);
  });

  it('rejects missing production Azure configuration without contacting Azure', () => {
    expect(() => createReplayStorageFromEnvironment({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(
      'AZURE_STORAGE_ACCOUNT_NAME'
    );
    expect(
      () => new AzureBlobReplayStorage({ accountName: 'generalsstorage', containerName: '' })
    ).toThrow('AZURE_REPLAY_CONTAINER');
  });
});
