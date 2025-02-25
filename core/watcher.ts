import { join, relative } from "../deps/path.ts";
import Events from "./events.ts";

import type { Event, EventListener, EventOptions } from "../core.ts";

/** The options to configure the local server */
export interface Options {
  /** The folder root to watch */
  root: string;

  /** Paths ignored by the watcher */
  ignore?: string[];

  /** The debounce waiting time */
  debounce?: number;
}

/** Custom events for server */
export interface WatchEvent extends Event {
  /** The event type */
  type: WatchEventType;

  /** The list of changed files (only for "change" events) */
  files?: Set<string>;

  /** The error object (only for "error" events) */
  error?: Error;
}

/** The available event types */
export type WatchEventType =
  | "start"
  | "change"
  | "error";

export default class Watcher {
  events: Events<WatchEvent> = new Events<WatchEvent>();
  options: Options;

  constructor(options: Options) {
    this.options = options;
  }

  /** Add a listener to an event */
  addEventListener(
    type: WatchEventType,
    listener: EventListener<WatchEvent>,
    options?: EventOptions,
  ) {
    this.events.addEventListener(type, listener, options);
    return this;
  }

  /** Dispatch an event */
  dispatchEvent(event: WatchEvent) {
    return this.events.dispatchEvent(event);
  }

  /** Start the file watcher */
  async start() {
    const { root, ignore, debounce } = this.options;
    const watcher = Deno.watchFs(root);
    const changes = new Set<string>();
    let timer = 0;
    let runningCallback = false;

    await this.dispatchEvent({ type: "start" });

    const callback = async () => {
      if (!changes.size || runningCallback) {
        return;
      }

      const files = new Set(changes);
      changes.clear();

      runningCallback = true;

      try {
        const result = await this.dispatchEvent({ type: "change", files });
        if (false === result) {
          return watcher.close();
        }
      } catch (error) {
        await this.dispatchEvent({ type: "error", error });
      }
      runningCallback = false;
    };

    for await (const event of watcher) {
      let { paths } = event;

      // Filter ignored paths
      paths = paths.filter((path) => {
        if (path.endsWith(".DS_Store")) { // macOS file
          return false;
        }

        return ignore
          ? !ignore.some((ignore) => path.startsWith(join(root, ignore, "/")))
          : true;
      });

      if (!paths.length) {
        continue;
      }

      paths.forEach((path) => changes.add(join("/", relative(root, path))));

      // Debounce
      clearTimeout(timer);
      timer = setTimeout(callback, debounce ?? 100);
    }
  }
}
