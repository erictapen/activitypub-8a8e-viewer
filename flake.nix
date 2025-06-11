{
  description = "ActivityPub Event Web Component";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    pre-commit-hooks.url = "github:cachix/git-hooks.nix";
    pre-commit-hooks.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      pre-commit-hooks,
    }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" ] (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {

        packages = {
        };

        devShells.default = pkgs.mkShell rec {
          inherit (self.checks.${system}.pre-commit-check) shellHook;

          nativeBuildInputs = with pkgs; [
            typescript
            nodejs
            (import ./nginx.nix pkgs)
            deno
          ];
        };

        checks.pre-commit-check = pre-commit-hooks.lib.${system}.run {
          src = ./.;
          hooks = {
            nixfmt-rfc-style.enable = true;
            denofmt.enable = true;
            denolint.enable = true;
            denotest = {
              enable = true;
              entry = "npm run test";
              pass_filenames = false;
            };
          };
        };

      }
    );
}
