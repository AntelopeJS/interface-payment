import { antelopeKnipConfig } from "@antelopejs/tooling-configs/knip";

export default antelopeKnipConfig({
  entry: ["test/*.test.js", "src/tests/**/*.test.ts", "src/antelope.test.ts"],
  project: ["test/*.test.js"],
  ignoreBinaries: ["ajs"],
});
