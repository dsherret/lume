import { assert, assertStrictEquals as equals } from "../deps/assert.ts";
import lume from "../mod.ts";
import { assertEqualsPaths, platformPath } from "./utils.ts";

Deno.test("default configuration", () => {
  const site = lume();
  const { options } = site;

  equals(options.cwd, Deno.cwd());
  equals(options.src, "./");
  equals(options.dest, "./_site");
  equals(options.location.href, "http://localhost/");
  equals(options.dev, false);
  equals(options.prettyUrls, true);
  equals(options.server.port, 3000);
  equals(options.server.page404, "/404.html");
  equals(options.server.open, false);
});

Deno.test("static files configuration", () => {
  const site = lume();
  const { staticFiles } = site;

  site.copy("img");
  equals(staticFiles.paths.size, 1);
  equals(staticFiles.paths.has(platformPath("/img")), true);
  equals(staticFiles.paths.get(platformPath("/img")), platformPath("/img"));

  site.copy("statics/favicon.ico", "favicon.ico");
  equals(staticFiles.paths.size, 2);
  equals(
    staticFiles.paths.get(platformPath("/statics/favicon.ico")),
    platformPath("/favicon.ico"),
  );

  site.copy("css", ".");
  equals(staticFiles.paths.size, 3);
  equals(staticFiles.paths.get(platformPath("/css")), platformPath("/"));
});

Deno.test("ignored files configuration", () => {
  const site = lume();
  const { ignored, filters } = site.source;

  equals(ignored.size, 6);
  equals(filters.length, 0);
  equals(ignored.has(platformPath("/node_modules")), true);
  equals(ignored.has(platformPath("/_site")), true);
  equals(ignored.has(platformPath("/_components")), true);
  equals(ignored.has(platformPath("/_includes")), true);
  equals(ignored.has(platformPath("/import_map.json")), true);
  equals(ignored.has(platformPath("/deno.json")), true);

  site.ignore("README.md");
  equals(ignored.size, 7);
  equals(filters.length, 0);
  equals(ignored.has(platformPath("/README.md")), true);

  site.ignore("file2", "file3", "README.md");
  equals(ignored.size, 9);
  equals(filters.length, 0);
  equals(ignored.has(platformPath("/file2")), true);
  equals(ignored.has(platformPath("/file3")), true);

  const filter = (path: string) => path.includes("file");
  site.ignore(filter);
  site.copy("img");
  site.copy("statics", ".");
  equals(ignored.size, 11);
  equals(filters.length, 1);
  equals(filters[0], filter);
  equals(ignored.has(platformPath("/img")), true);
  equals(ignored.has(platformPath("/statics")), true);
});

Deno.test("event listener configuration", () => {
  const site = lume();
  const { listeners } = site.events;

  equals(listeners.size, 1);
  equals(listeners.has("beforeUpdate"), true);
  equals(listeners.get("beforeUpdate")?.size, 1);

  site.addEventListener("afterBuild", "afterbuild-command");
  equals(listeners.get("afterBuild")?.size, 1);
  const listenersList = Array.from(listeners.get("afterBuild")!);
  equals(typeof listenersList[0][0], "function");
});

Deno.test("script configuration", () => {
  const site = lume();
  const { scripts } = site.scripts;

  equals(scripts.size, 0);

  site.script("script1", "script1-command");
  equals(scripts.size, 1);
  equals(scripts.has("script1"), true);
  equals(scripts.get("script1")?.length, 1);
  equals(scripts.get("script1")?.[0], "script1-command");

  site.script("script2", "script2-command-1", "script2-command-2");
  equals(scripts.size, 2);
  equals(scripts.has("script2"), true);
  equals(scripts.get("script2")?.length, 2);
  equals(scripts.get("script2")?.[0], "script2-command-1");
  equals(scripts.get("script2")?.[1], "script2-command-2");

  site.script("script3", ["script3-command-1", "script3-command-2"]);
  equals(scripts.size, 3);
  equals(scripts.has("script3"), true);
  equals(scripts.get("script3")?.length, 1);

  const script3 = scripts.get("script3")?.[0] as string[];
  equals(script3[0], "script3-command-1");
  equals(script3[1], "script3-command-2");
});

Deno.test("data configuration", () => {
  const site = lume();
  const { formats } = site;

  equals(formats.size, 10);
  equals(formats.has(".json"), true);
  assert(formats.get(".json")?.dataLoader);
  equals(formats.has(".js"), true);
  assert(formats.get(".js")?.dataLoader);
  equals(formats.has(".ts"), true);
  assert(formats.get(".ts")?.dataLoader);
  equals(formats.has(".yaml"), true);
  assert(formats.get(".yaml")?.dataLoader);
  equals(formats.has(".yml"), true);
  assert(formats.get(".yml")?.dataLoader);

  const loader = () => Promise.resolve({});
  site.loadData([".ext1", ".ext2"], loader);

  equals(formats.size, 12);
  equals(formats.get(".ext1")?.dataLoader, loader);
  equals(formats.get(".ext2")?.dataLoader, loader);
});

Deno.test("pages configuration", () => {
  const site = lume();
  const { formats } = site;

  equals(formats.size, 10);
  equals(formats.has(".tmpl.json"), true);
  equals(formats.get(".tmpl.json")?.pageType, "page");
  equals(formats.has(".tmpl.js"), true);
  equals(formats.get(".tmpl.js")?.pageType, "page");
  assert(formats.get(".tmpl.js")?.engine);
  equals(formats.has(".tmpl.ts"), true);
  equals(formats.get(".tmpl.ts")?.pageType, "page");
  assert(formats.get(".tmpl.ts")?.engine);
  equals(formats.has(".md"), true);
  equals(formats.get(".md")?.pageType, "page");
  assert(formats.get(".md")?.engine);
  equals(formats.has(".njk"), true);
  equals(formats.get(".njk")?.pageType, "page");
  assert(formats.get(".njk")?.engine);
  equals(formats.has(".yaml"), true);
  equals(formats.get(".yaml")?.pageType, "page");
  equals(formats.has(".yml"), true);
  equals(formats.get(".yml")?.pageType, "page");

  const loader = () => Promise.resolve({});
  const engine = {
    deleteCache: () => {},
    render: () => {},
    renderSync: () => "",
    addHelper: () => {},
  };

  site.loadPages([".ext1", ".ext2"], loader, engine);

  equals(formats.size, 12);
  equals(formats.get(".ext1")?.pageLoader, loader);
  equals(formats.get(".ext1")?.pageType, "page");
  assert(formats.get(".ext1")?.engine);
  equals(formats.get(".ext2")?.pageLoader, loader);
  equals(formats.get(".ext2")?.pageType, "page");
  assert(formats.get(".ext2")?.engine);
});

Deno.test("assets configuration", () => {
  const site = lume();
  const { formats } = site;

  equals(formats.size, 10);

  const loader = () => Promise.resolve({});
  site.loadAssets([".css", ".js"], loader);

  equals(formats.size, 11);
  equals(formats.has(".css"), true);
  equals(formats.get(".css")?.pageLoader, loader);
  equals(formats.get(".css")?.pageType, "asset");
  equals(formats.has(".js"), true);
  equals(formats.get(".js")?.pageLoader, loader);
  equals(formats.get(".js")?.pageType, "asset");
});

Deno.test("preprocessor configuration", () => {
  const site = lume();

  const { processors } = site.preprocessors;

  equals(processors.size, 0);

  const processor = () => Promise.resolve({});
  const ext1 = [".ext1"];

  site.preprocess(ext1, processor);
  equals(processors.size, 1);
  equals(processors.has(processor), true);
  equals(processors.get(processor), ext1);

  const ext2 = [".ext2"];
  site.preprocess(ext2, processor);
  equals(processors.size, 1);
  equals(processors.has(processor), true);
  equals(processors.get(processor), ext2);

  const processor2 = () => Promise.resolve({});
  site.preprocess(ext2, processor2);
  equals(processors.size, 2);
  equals(processors.has(processor2), true);
  equals(processors.get(processor2), ext2);
});

Deno.test("processor configuration", () => {
  const site = lume();
  const { processors } = site.processors;

  equals(processors.size, 0);

  const processor = () => Promise.resolve({});
  const ext1 = [".ext1"];

  site.process(ext1, processor);
  equals(processors.size, 1);
  equals(processors.has(processor), true);
  equals(processors.get(processor), ext1);

  const ext2 = [".ext2"];
  site.process(ext2, processor);
  equals(processors.size, 1);
  equals(processors.has(processor), true);
  equals(processors.get(processor), ext2);

  const processor2 = () => Promise.resolve({});
  site.process(ext2, processor2);
  equals(processors.size, 2);
  equals(processors.has(processor2), true);
  equals(processors.get(processor2), ext2);
});

Deno.test("helpers configuration", () => {
  const site = lume();
  const { helpers } = site.engines;

  equals(helpers.size, 4);
  equals(helpers.has("url"), true);
  equals(helpers.has("htmlUrl"), true);
  equals(helpers.has("md"), true);
  equals(helpers.has("njk"), true);

  const helper = () => {};
  const options = { type: "filter" };

  site.helper("helper1", helper, options);
  equals(helpers.size, 5);
  equals(helpers.has("helper1"), true);
  equals(helpers.get("helper1")![0], helper);
  equals(helpers.get("helper1")![1], options);

  const filter = () => {};
  site.filter("filter1", filter, true);
  equals(helpers.size, 6);
  equals(helpers.has("filter1"), true);
  equals(helpers.get("filter1")![0], filter);
  equals(helpers.get("filter1")![1].type, "filter");
  equals(helpers.get("filter1")![1].async, true);
});

Deno.test("extra data", () => {
  const site = lume();
  const { globalData } = site;

  equals(Object.keys(globalData).length, 2);
  equals(Object.keys(globalData)[0], "paginate");
  equals(Object.keys(globalData)[1], "search");

  site.data("name", "lume");
  equals(Object.keys(globalData).length, 3);
  equals(globalData.name, "lume");
});

Deno.test("url location", () => {
  const site = lume({
    location: new URL("https://example.com/subfolder/"),
  });

  equals(site.options.location.href, "https://example.com/subfolder/");
  equals(site.url("/"), "/subfolder/");
  equals(site.url("foo"), "/subfolder/foo");
  equals(site.url("foo/../bar"), "/subfolder/bar");
  equals(site.url("/subfolder/styles.css"), "/subfolder/styles.css");
  equals(site.url("./foo"), "./foo");
  equals(site.url("../foo"), "../foo");
  equals(site.url("?foo=bar"), "?foo=bar");
  equals(site.url("#foo"), "#foo");
  equals(site.url("http://domain.com"), "http://domain.com/");

  // Absolute urls
  equals(site.url("/", true), "https://example.com/subfolder/");
  equals(site.url("foo", true), "https://example.com/subfolder/foo");
  equals(site.url("foo/../bar", true), "https://example.com/subfolder/bar");
  equals(
    site.url("/subfolder/styles.css", true),
    "https://example.com/subfolder/styles.css",
  );
  equals(site.url("./foo", true), "./foo");
  equals(site.url("../foo", true), "../foo");
  equals(site.url("?foo=bar", true), "?foo=bar");
  equals(site.url("#foo", true), "#foo");
  equals(site.url("http://domain.com", true), "http://domain.com/");
});

Deno.test("src/dest paths", () => {
  const site = lume({
    cwd: "/projects/my-website",
    src: "src-files",
    dest: "dist",
  });

  equals(site.options.cwd, "/projects/my-website");
  equals(site.options.src, "src-files");
  equals(site.options.dest, "dist");

  assertEqualsPaths(site.src(), "/projects/my-website/src-files");
  assertEqualsPaths(site.src("."), "/projects/my-website/src-files");
  assertEqualsPaths(site.src("/"), "/projects/my-website/src-files/");
  assertEqualsPaths(
    site.src("pages/posts"),
    "/projects/my-website/src-files/pages/posts",
  );

  assertEqualsPaths(site.dest(), "/projects/my-website/dist");
  assertEqualsPaths(site.dest("."), "/projects/my-website/dist");
  assertEqualsPaths(site.dest("/"), "/projects/my-website/dist/");
  assertEqualsPaths(
    site.dest("pages/posts"),
    "/projects/my-website/dist/pages/posts",
  );
});
