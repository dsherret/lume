import { getDenoConfig, getImportMap, merge } from "../core/utils.ts";
import { toFileUrl } from "../deps/path.ts";
import { createGraph, load, LoadResponse } from "../deps/graph.ts";
import { Page } from "../core/filesystem.ts";

import type { Site } from "../core.ts";
import type { LoadResponseModule } from "../deps/graph.ts";

export interface Options {
  /** The list of extensions this plugin applies to */
  extensions: string[];

  /** Set `true` to generate source map files */
  sourceMap: boolean;

  /** The options for Deno.emit */
  options: Deno.EmitOptions;
}

// Default options
export const defaults: Options = {
  extensions: [".ts", ".js"],
  sourceMap: false,
  options: {},
};

const denoConfig = await getDenoConfig();

/** A plugin to load all .js, .ts, .jsx, .tsx files and bundle them using Deno.emit() */
export default function (userOptions?: Partial<Options>) {
  const options = merge(defaults, userOptions);

  return (site: Site) => {
    const sources: Record<string, string> = {};
    let importMap: Deno.ImportMap | undefined;
    let importMapPath: string | undefined;

    // Load import map
    site.addEventListener("beforeBuild", async () => {
      importMapPath = options.options.importMapPath || denoConfig?.importMap;
      importMap = options.options.importMap ||
        (importMapPath ? await getImportMap(importMapPath) : undefined);
    });

    // Refresh updated files
    site.addEventListener("beforeUpdate", (event) => {
      event.files?.forEach((file) => {
        const specifier = toFileUrl(site.src(file)).href;
        delete sources[specifier];
      });
    });

    site.loadAssets(options.extensions);

    /**
     * For bundle, we need to load all the files sources
     * before emitting the bundle
     */
    if (options.options.bundle) {
      // Load all source files and save the content in `sources`
      site.process(options.extensions, (file: Page) => {
        const specifier = getSpecifier(file);
        sources[specifier] = file.content as string;
      });

      // Load all other dependencies and save the content in `sources`
      site.process(options.extensions, async (file: Page) => {
        const specifier = getSpecifier(file);

        await createGraph(specifier, {
          resolve(specifier, referrer) {
            return isBare(specifier)
              ? getFileSpecifier(specifier)
              : new URL(specifier, referrer).href;
          },
          async load(
            specifier: string,
            isDynamic: boolean,
          ): Promise<LoadResponse | undefined> {
            if (isDynamic) {
              return;
            }
            if (specifier in sources) {
              return {
                kind: "module",
                specifier: specifier,
                content: sources[specifier],
              };
            }

            const response = await load(specifier) as LoadResponseModule;

            if (response) {
              sources[specifier] = response.content;
              return response;
            }
          },
        });
      });
    }

    // Now we are ready to emit the entries
    site.process(options.extensions, async (file: Page) => {
      const specifier = getSpecifier(file);
      const { files } = await Deno.emit(specifier, {
        ...options.options,
        sources: {
          ...sources,
          [specifier]: file.content as string,
        },
        importMap,
        importMapPath,
      });

      const content = files[specifier] || files[specifier + ".js"] ||
        files["deno:///bundle.js"];

      if (content) {
        file.content = fixExtensions(content);
        file.ext = ".js";
      }

      const mapContent = files[specifier + ".map"] ||
        files[specifier + ".js.map"] || files["deno:///bundle.js.map"];

      if (options.sourceMap && mapContent) {
        const mapFile = Page.create(file.dest.path + ".js.map", mapContent);
        site.pages.push(mapFile);
      }
    });

    function getSpecifier(file: Page) {
      file._data.specifier ||=
        toFileUrl(site.src(file.data.url as string)).href;
      return file._data.specifier as string;
    }

    function getFileSpecifier(file: string) {
      for (const key in importMap?.imports) {
        if (file.startsWith(key)) {
          return importMap?.imports[key] + file.slice(key.length);
        }
      }
      throw new Error(`Invalid specifier ${file}`);
    }
  };
}

/** Replace all .ts, .tsx and .jsx files with .js files */
function fixExtensions(content: string) {
  return content.replaceAll(/\.(ts|tsx|jsx)("|')/ig, ".js$2");
}

function isBare(specifier: string) {
  return !specifier.startsWith(".") && !specifier.includes("://");
}
