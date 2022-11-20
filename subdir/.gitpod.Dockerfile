FROM gitpod/workspace-full:latest

ENV DEBIAN_FRONTEND=noninteractive

RUN sudo apt-get update \
    && sudo apt-get install -y tmux \
    && sudo apt-get install -y neovim \
    && sudo rm -rf /var/lib/apt/lists/*

RUN brew install fzf
# vim-plug
RUN bash -c 'curl -fLo "${XDG_DATA_HOME:-$HOME/.local/share}"/nvim/site/autoload/plug.vim --create-dirs https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim'

RUN mkdir -p ~/.config/nvim/
# Download rcfiles
RUN curl https://raw.githubusercontent.com/mlejva/rcfiles/master/init.vim --output ~/.config/nvim/init.vim
RUN curl https://raw.githubusercontent.com/mlejva/rcfiles/master/tmux.conf --output ~/.tmux.conf

RUN bash -c ". .nvm/nvm.sh && nvm install 16.4.0 && nvm use 16.4.0 && nvm alias default 16.4.0"

RUN echo "nvm use default &>/dev/null" >> ~/.bashrc.d/51-nvm-fix

RUN npm i depcheck npm-check-updates -g
