import { defineConfig } from "@antelopejs/interface-core/config";

export default defineConfig({
  name: "interface-payment-test",
  cacheFolder: ".antelope/cache",
  modules: {},
  test: { folder: "test" },
});
