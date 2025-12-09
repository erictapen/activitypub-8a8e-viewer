{
  description = "ActivityPub Event Web Component";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    pre-commit-hooks.url = "github:cachix/git-hooks.nix";
    pre-commit-hooks.inputs.nixpkgs.follows = "nixpkgs";
    napalm.url = "github:nix-community/napalm";
    napalm.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      pre-commit-hooks,
      napalm,
    }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" ] (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        sandboxablePreCommitHooks = {
          nixfmt-rfc-style.enable = true;
          denofmt.enable = true;
          denolint.enable = true;
        };
      in
      {

        packages.default = napalm.legacyPackages."${system}".buildPackage ./. {
          inherit (pkgs) nodejs;
          npmCommands = [
            "npm install"
            "npm run build"
          ];
          nativeBuildInputs = with pkgs; [
            deno
            typescript
          ];
          # This is just for reducing closure size, as we supply typescript vian nativeBuildInputs
          customPatchPackages.typescript = pkgs: _: {
            postInstall = ''
              rm -r $out/package/*
            '';
          };
        };

        devShells.default = pkgs.mkShell rec {
          inherit
            (pre-commit-hooks.lib.${system}.run {
              src = ./.;
              hooks = sandboxablePreCommitHooks // {
                denotest = {
                  enable = true;
                  entry = "${pkgs.lib.getExe pkgs.deno} test --config tsconfig.json";
                  pass_filenames = false;
                };
              };
            })
            shellHook
            ;

          nativeBuildInputs = with pkgs; [
            typescript
            nodejs
            (import ./nginx.nix pkgs)
            deno
          ];
        };

        checks.pre-commit-check = pre-commit-hooks.lib.${system}.run {
          src = ./.;
          hooks = sandboxablePreCommitHooks;
        };

      }
    );
}
