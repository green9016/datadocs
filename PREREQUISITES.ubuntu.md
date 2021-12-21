# Ubuntu 18 Prerequisites

## Initial setup

`$ sudo apt-get update`

`$ sudo apt-get install build-essential`

`$ sudo apt-get install vim`

`$ sudo apt-get install git-core`

## Node 

https://github.com/nvm-sh/nvm

`$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.2/install.sh | bash`

`$ command -v nvm`

`$ nvm install 8.16.2`

`$ nvm use 8.16.2`

## Yarn 

https://yarnpkg.com/lang/en/docs/install/#debian-stable

`$ curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -`

`$ echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list`

`$ sudo apt update && sudo apt install --no-install-recommends yarn`

# Docker 

https://docs.docker.com/install/linux/docker-ce/ubuntu/
https://download.docker.com/linux/ubuntu/dists/bionic/pool/stable/amd64/

```
$ sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common
```

`$ curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -`

`$ sudo apt-key fingerprint 0EBFCD88`

`$ curl -O https://download.docker.com/linux/ubuntu/dists/bionic/pool/stable/amd64/docker-ce_18.09.0~3-0~ubuntu-bionic_amd64.deb`

`$ curl -O https://download.docker.com/linux/ubuntu/dists/bionic/pool/stable/amd64/containerd.io_1.2.6-3_amd64.deb`

`$ curl -O https://download.docker.com/linux/ubuntu/dists/bionic/pool/stable/amd64/docker-ce-cli_18.09.9~3-0~ubuntu-bionic_amd64.deb`

`$ sudo dpkg -i docker-ce-cli_18.09.9~3-0~ubuntu-bionic_amd64.deb`

`$ sudo dpkg -i containerd.io_1.2.6-3_amd64.deb`

`$ sudo dpkg -i docker-ce_18.09.0~3-0~ubuntu-bionic_amd64.deb`

`$ sudo usermod -aG docker $USER`

`$ newgrp docker`
