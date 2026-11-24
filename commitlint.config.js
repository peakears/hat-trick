// Commit messages follow Conventional Commits, which release-please uses to pick the version bump.
// https://www.conventionalcommits.org
export default {
  extends: ["@commitlint/config-conventional"],
  // Dependabot's headers follow the rules ("chore(deps): bump ..."), but its bodies paste release notes with
  // lines longer than the 100 characters allowed. Its commits are signed off, so skip those.
  ignores: [(message) => /^Signed-off-by: dependabot\[bot\]/m.test(message)],
};
