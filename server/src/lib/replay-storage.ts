import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { promises as fsPromises } from 'fs';
import path from 'path';

export const LOCAL_REPLAY_STORAGE = 'LOCAL_FILESYSTEM';
export const AZURE_REPLAY_STORAGE = 'AZURE_BLOB';
export type ReplayStorageType = typeof LOCAL_REPLAY_STORAGE | typeof AZURE_REPLAY_STORAGE;

export interface ReplayStorageReference {
  replayId: string;
  storageType: ReplayStorageType;
  objectKey: string;
}

export interface ReplayStorage {
  readonly storageType: ReplayStorageType;
  objectKey(matchId: string): string;
  saveReplay(matchId: string, replayJson: string): Promise<ReplayStorageReference>;
  readReplay(objectKey: string): Promise<string | null>;
}

interface BlobDownloadResponseLike {
  readableStreamBody?: NodeJS.ReadableStream;
}

interface BlobClientLike {
  download(offset?: number): Promise<BlobDownloadResponseLike>;
}

interface BlockBlobClientLike {
  upload(data: string, length: number, options?: unknown): Promise<unknown>;
}

export interface ReplayContainerClient {
  getBlockBlobClient(blobName: string): BlockBlobClientLike;
  getBlobClient(blobName: string): BlobClientLike;
}

function assertSafeIdentifier(value: string): void {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(value)) throw new Error('Replay identifier is invalid.');
}

function isNotFound(error: unknown): boolean {
  const candidate = error as { statusCode?: number; code?: string };
  return candidate?.statusCode === 404 || candidate?.code === 'BlobNotFound' || candidate?.code === 'ENOENT';
}

async function streamToString(stream?: NodeJS.ReadableStream): Promise<string> {
  if (!stream) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of stream as any) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks as any).toString('utf8');
}

export class LocalReplayStorage implements ReplayStorage {
  readonly storageType = LOCAL_REPLAY_STORAGE;

  constructor(private readonly rootDirectory = process.cwd()) {}

  objectKey(matchId: string): string {
    assertSafeIdentifier(matchId);
    return `records/${matchId}.json`;
  }

  async saveReplay(matchId: string, replayJson: string): Promise<ReplayStorageReference> {
    const objectKey = this.objectKey(matchId);
    const filePath = this.resolveObjectKey(objectKey);
    await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
    await fsPromises.writeFile(filePath, replayJson, 'utf8');
    return { replayId: matchId, storageType: this.storageType, objectKey };
  }

  async readReplay(objectKey: string): Promise<string | null> {
    try {
      return await fsPromises.readFile(this.resolveObjectKey(objectKey), 'utf8');
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  private resolveObjectKey(objectKey: string): string {
    const match = /^records\/([A-Za-z0-9_-]{1,100})\.json$/.exec(objectKey);
    if (!match) throw new Error('Local replay object key is invalid.');
    const recordsDirectory = path.resolve(this.rootDirectory, 'records');
    const resolved = path.resolve(this.rootDirectory, objectKey);
    if (!resolved.startsWith(`${recordsDirectory}${path.sep}`)) throw new Error('Local replay path is invalid.');
    return resolved;
  }
}

export interface AzureBlobReplayStorageOptions {
  accountName: string;
  containerName: string;
  containerClient?: ReplayContainerClient;
}

export function azureReplayObjectKey(matchId: string): string {
  assertSafeIdentifier(matchId);
  return `replays/${matchId}.json`;
}

export class AzureBlobReplayStorage implements ReplayStorage {
  readonly storageType = AZURE_REPLAY_STORAGE;
  private readonly containerClient: ReplayContainerClient;

  constructor(options: AzureBlobReplayStorageOptions) {
    const accountName = options.accountName.trim();
    const containerName = options.containerName.trim();
    if (!accountName) throw new Error('AZURE_STORAGE_ACCOUNT_NAME is required for Azure replay storage.');
    if (!containerName) throw new Error('AZURE_REPLAY_CONTAINER is required for Azure replay storage.');
    this.containerClient =
      options.containerClient ||
      new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        new DefaultAzureCredential()
      ).getContainerClient(containerName);
  }

  objectKey(matchId: string): string {
    return azureReplayObjectKey(matchId);
  }

  async saveReplay(matchId: string, replayJson: string): Promise<ReplayStorageReference> {
    const objectKey = this.objectKey(matchId);
    const blob = this.containerClient.getBlockBlobClient(objectKey);
    await blob.upload(replayJson, Buffer.byteLength(replayJson), {
      blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
    });
    return { replayId: matchId, storageType: this.storageType, objectKey };
  }

  async readReplay(objectKey: string): Promise<string | null> {
    if (!/^replays\/[A-Za-z0-9_-]{1,100}\.json$/.test(objectKey)) {
      throw new Error('Azure replay object key is invalid.');
    }
    try {
      const response = await this.containerClient.getBlobClient(objectKey).download(0);
      return await streamToString(response.readableStreamBody);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }
}

export function createReplayStorageFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  localRootDirectory = process.cwd()
): ReplayStorage {
  if (environment.NODE_ENV !== 'production') return new LocalReplayStorage(localRootDirectory);
  return new AzureBlobReplayStorage({
    accountName: environment.AZURE_STORAGE_ACCOUNT_NAME || '',
    containerName: environment.AZURE_REPLAY_CONTAINER || '',
  });
}

export type ReplayStorageResolver = (storageType: string) => ReplayStorage;

export function createReplayStorageResolver(
  currentStorage: ReplayStorage,
  environment: NodeJS.ProcessEnv = process.env,
  localRootDirectory = process.cwd()
): ReplayStorageResolver {
  const localStorage =
    currentStorage.storageType === LOCAL_REPLAY_STORAGE
      ? currentStorage
      : new LocalReplayStorage(localRootDirectory);
  let azureStorage = currentStorage.storageType === AZURE_REPLAY_STORAGE ? currentStorage : null;
  return (storageType: string) => {
    if (storageType === LOCAL_REPLAY_STORAGE) return localStorage;
    if (storageType === AZURE_REPLAY_STORAGE) {
      azureStorage ||= new AzureBlobReplayStorage({
        accountName: environment.AZURE_STORAGE_ACCOUNT_NAME || '',
        containerName: environment.AZURE_REPLAY_CONTAINER || '',
      });
      return azureStorage;
    }
    throw new Error(`Unsupported replay storage type: ${storageType}`);
  };
}
