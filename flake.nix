# SPDX-FileCopyrightText: 2025 Kerstin Humm <kerstin@erictapen.name>
#
# SPDX-License-Identifier: AGPL-3.0-or-later

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
          reuse.enable = true;
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
            nodejs
            # For the NPM IBM Plex fonts packages
            (pkgs.writeShellScriptBin "ibmtelemetry" ''
              echo "Don't gather telemetry"
            '')
          ];
          postPatch = pkgs.lib.optionalString (self ? rev) (
            let
              lastModified =
                let
                  sub = start: len: builtins.substring start len self.lastModifiedDate;
                in
                "${sub 0 4}-${sub 4 2}-${sub 6 2}T${sub 8 2}:${sub 10 2}:${sub 12 2}Z";

            in
            ''
              substituteInPlace index.html \
                --replace-fail \
                'Source: dirty, Last modified: unknown' \
                'Source: <a href="https://github.com/erictapen/activitypub-8a8e-viewer/commit/${self.rev}">${self.shortRev}</a>, Last modified: ${lastModified}'
            ''
          );
          # This is just for reducing closure size, as we supply typescript via nativeBuildInputs
          customPatchPackages = {
            typescript = pkgs: _: {
              postInstall = ''
                rm -r $out/package/*
              '';
            };
            # For the NPM IBM Plex fonts packages
            "@ibm/telemetry-js" = pkgs: _: {
              postInstall = ''
                rm -r $out/package/*
              '';
            };
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

          # For the NPM IBM Plex fonts packages
          env.IBM_TELEMETRY_DISABLED = "true";

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
