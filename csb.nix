with import <nixpkgs> {};
 
stdenv.mkDerivation {
    name = "csb";
    buildInputs = [
        poetry
        jdk11_headless
    ];
    shellHook = ''
        export PATH="$PWD/node_modules/.bin/:$PATH"
    '';
}
