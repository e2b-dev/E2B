# Releasing e2b cli 

to create a changeset run `npx changeset`


# Enter Nix development shell 

install nix 

```
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
```

enter the dev shell 
```
nix develop --command zsh
# or
nix develop --command bash
```