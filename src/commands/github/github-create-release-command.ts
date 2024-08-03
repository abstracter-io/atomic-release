import mime from 'mime';
import fs from 'node:fs';
import path from 'node:path';
import { to } from 'await-to-js';
import { Readable } from 'node:stream';

import { timer } from '../../utils/timer.js';
import { GithubHttpCommand, GithubHttpCommandConfig } from './github-http-command.js';

type File = {
  mimeType: string;
  bytesSize: number;
  readStream: Readable;
};

type Asset = {
  // An alternate short description of the asset.
  // Used in place of the filename. (per GitHub docs)
  label?: string;

  name: string;

  absoluteFilePath: string;
};

type ReleaseRestResource = Record<string, unknown>;

type GithubCreateReleaseCommandConfig = GithubHttpCommandConfig & {
  // name of the repo
  repo: string;

  // name of repo owner (the org name / username)
  owner: string;

  // the name of a PRE existing tag (i.e. tag present in the repo's remote)
  tagName: string;

  // when falsy, release is marked as pre-release
  isStable?: boolean;

  name: string;

  body?: string;

  assets?: (Omit<Asset, 'name'> & { name?: string })[];
};

/**
 @example
 const command = new GithubCreateReleaseCommand({
    owner: "abstracter-io",
    repo: "atomic-release",
    tagName: "v2.0.1",
    isStable: true,
    name: "RELEASE v2.0.1",
    body: "***This is SPARTA***",
    headers: {
      Authorization: "token [PERSONAL ACCESS TOKEN]",
    },
    assets: [
      { absoluteFilePath: "/home/rick/dev/package.json" },
      { absoluteFilePath: "/home/rick/dev/build.json", label: "." },
      { absoluteFilePath: "/home/rick/dev/package.json", name: "custom name" },
    ],
  });
 */
class GithubCreateReleaseCommand extends GithubHttpCommand<GithubCreateReleaseCommandConfig> {
  private createdRelease: ReleaseRestResource;

  private getAssets(): Asset[] {
    const assets = this.config.assets ?? [];
    const uniquelyNamedAssets = new Map<string, Asset>();

    for (const asset of assets) {
      const name = asset.name ?? path.basename(asset.absoluteFilePath);
      const previousAsset = uniquelyNamedAssets.get(name);

      if (previousAsset) {
        this.logger.warn(`An asset named '${name}' already exists`);
        this.logger.warn('Duplicate asset will be filtered out');
      }
      //
      else {
        uniquelyNamedAssets.set(name, {
          ...asset,
          name,
        });
      }
    }

    return Array.from(uniquelyNamedAssets.values());
  }

  private async createRelease(): Promise<ReleaseRestResource> {
    const { owner, repo, name, tagName, body, isStable } = this.config;
    const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
    const hasAssets = Array.isArray(this.config.assets) && this.config.assets.length > 0;
    const response = await this.fetch(url, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        tag_name: tagName,
        name,
        body,
        draft: hasAssets,
        prerelease: !isStable,
      }),
    });

    if (response.status === 201) {
      return (await response.json()) as ReleaseRestResource;
    }

    throw new Error(`Failed to create release. Status code is ${response.status}`);
  }

  private async getFile(absoluteFilePath: string): Promise<File> {
    const [error, stat] = await to(fs.promises.stat(absoluteFilePath));

    if (stat) {
      if (stat.isFile()) {
        const mimeType = mime.getType(path.extname(absoluteFilePath));

        if (mimeType === null) {
          throw new Error('unknown mime type');
        }

        return {
          mimeType,
          bytesSize: stat.size,
          readStream: Readable.from(fs.createReadStream(absoluteFilePath, 'utf-8')),
        };
      }
    }

    if (error) {
      this.logger.error(error);
    }

    throw new Error(`File '${absoluteFilePath}' does not exists or is not as file`);
  }

  private async deleteRelease(resource: ReleaseRestResource): Promise<void> {
    const { owner, repo } = this.config;
    const releaseURL = resource.html_url;
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/${resource.id}`;
    const response = await this.fetch(url, {
      method: 'DELETE',
    });

    if (response.status === 204) {
      this.logger.info(`Deleted release: ${releaseURL}`);
    }
    //
    else {
      this.logger.warn(`Failed to delete release '${releaseURL}'. Status code is ${response.status}`);
    }
  }

  private async publishRelease(url: string): Promise<ReleaseRestResource> {
    const response = await this.fetch(url, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        draft: false,
      }),
    });

    if (response.status !== 200) {
      throw new Error(`Failed to take release out of draft mode. Status code is ${response.status}`);
    }

    return await response.json() as Record<string, unknown>;
  }

  private async uploadAsset(uploadURL: string, asset: Asset): Promise<Response> {
    const path = asset.absoluteFilePath;
    const file = await this.getFile(path);
    const url = this.expendURL(uploadURL, {
      name: asset.name,
      label: asset.label,
    });

    return this.fetch(url, {
      method: 'POST',

      headers: {
        'Content-Length': file.bytesSize.toString(),
        'Content-Type': file.mimeType,
      },

      body: file.readStream,
    });
  }

  public async undo(): Promise<void> {
    if (this.createdRelease) {
      await this.deleteRelease(this.createdRelease);
    }
  }

  public async do(): Promise<void> {
    const uploads: Promise<Response>[] = [];
    const releaseRestResource = await this.createRelease();
    const releaseAssetUploadURL = releaseRestResource.upload_url as string;

    this.createdRelease = releaseRestResource;

    for (const asset of this.getAssets()) {
      const upload = async (): Promise<Response> => {
        const uploadTimer = timer();
        const response = await this.uploadAsset(releaseAssetUploadURL, asset);

        if (response.status !== 201) {
          const resource = await response.json();

          this.logger.info(JSON.stringify(resource, null, 2));

          throw new Error(`Failed to upload asset '${asset.absoluteFilePath}'. Status code is ${response.status}`);
        }

        this.logger.info(`Asset: ${asset.absoluteFilePath} was uploaded in ${uploadTimer}`);

        return response;
      };

      this.logger.info(`Uploading asset named: ${asset.name} (src: ${asset.absoluteFilePath})`);

      uploads.push(upload());
    }

    if (uploads.length) {
      await Promise.all(uploads);

      this.createdRelease = await this.publishRelease(this.createdRelease.url as string);
    }

    this.logger.info(`Created release: ${this.createdRelease.html_url} (id: ${this.createdRelease.id})`);
  }
}

export { GithubCreateReleaseCommand, GithubCreateReleaseCommandConfig };
