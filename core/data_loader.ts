import { basename, extname, join } from "../deps/path.ts";

import type { Data, Formats, Reader } from "../core.ts";

export interface Options {
  /** The reader instance used to read the files */
  reader: Reader;

  /** The registered file formats */
  formats: Formats;
}

/**
 * Class to load data files.
 */
export default class DataLoader {
  /** The filesystem reader */
  reader: Reader;

  /** List of extensions to load data files and the loader used */
  formats: Formats;

  constructor(options: Options) {
    this.reader = options.reader;
    this.formats = options.formats;
  }

  async load(path: string): Promise<Data | undefined> {
    const info = await this.reader.getInfo(path);

    if (!info) {
      return;
    }

    if (info.isDirectory) {
      return this.#loadDirectory(path);
    }

    return this.#loadFile(path);
  }

  /** Load a _data.* file */
  async #loadFile(path: string): Promise<Data | undefined> {
    const result = this.formats.search(path);

    if (!result) {
      return;
    }

    const [, { dataLoader }] = result;

    if (!dataLoader) {
      return;
    }

    return await this.reader.read(path, dataLoader);
  }

  /** Load a _data directory */
  async #loadDirectory(path: string): Promise<Data> {
    const data: Data = {};

    for await (const entry of this.reader.readDir(path)) {
      await this.loadEntry(path, entry, data);
    }

    return data;
  }

  /**
   * Load a data entry inside a _data directory
   * and append the data to the data object
   */
  async loadEntry(path: string, entry: Deno.DirEntry, data: Data) {
    if (
      entry.isSymlink ||
      entry.name.startsWith(".") || entry.name.startsWith("_")
    ) {
      return;
    }

    if (entry.isFile) {
      const name = basename(entry.name, extname(entry.name));
      const fileData = await this.#loadFile(join(path, entry.name)) || {};

      if (fileData.content && Object.keys(fileData).length === 1) {
        data[name] = fileData.content;
      } else {
        data[name] = Object.assign(data[name] || {}, fileData);
      }

      return;
    }

    if (entry.isDirectory) {
      data[entry.name] = await this.#loadDirectory(join(path, entry.name));
    }
  }
}
