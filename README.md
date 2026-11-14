# Meting-API

https://meting-api-omega.vercel.app/test

## Feature

- js实现
- 插件系统，易于编写新接口及音源

## 进度

|               | server参数名称 | 图片 | 歌词 | url | 单曲/song | 歌单/playlist | 歌手/artist | 搜索/search |
| ------------- | -------------- | ---- | ---- | --- | --------- | ------------- | ----------- |--------- |
| 网易云        | netease        | √    | √    | √   | √         | √             | √           |√         |
| qq音乐        | tencent        | √    | √    | √   | √         | √             | √           |√         |

## 地区限制

### 部署在国外

| 客户端/浏览器访问地区 | 国内 | 国外 |
| --------------------- | ---- | ---- |
| 网易云                | √    | √    |
| qq音乐                | √¹   | ×    |


### 部署在国内

| 客户端/浏览器访问地区 | 国内 | 国外 |
| --------------------- | ---- | ---- |
| 网易云                | √    | √    |
| qq音乐                | √    | ×    |


¹使用jsonp，**需要替换前端插件**， https://cdn.jsdelivr.net/npm/meting@2.0.1/dist/Meting.min.js => https://cdn.jsdelivr.net/npm/@xizeyoupan/meting@latest/dist/Meting.min.js , or 
https://unpkg.com/meting@2.0.1/dist/Meting.min.js => https://unpkg.com/@xizeyoupan/meting@latest/dist/Meting.min.js

More info https://github.com/xizeyoupan/MetingJS

## 音源架构

标准网易云音乐和 QQ 音乐接口由 `@meting/core` 统一处理；Spotify 与 YouTube Music 继续使用 `YT_API` / `SPOTIFY_API` 外部服务。设置 `OVERSEAS=1` 时，QQ 音乐的 `song`、`playlist`、`url` 保留原有 JSONP 实现，以兼容 `@xizeyoupan/meting` 前端插件。

Deno、Cloudflare 等非 Node 运行路径继续使用本地兼容 provider 实现；`@meting/core` 适配用于 Node 运行路径。

## 参数配置
以下参数均由环境变量配置

- OVERSEAS
  用于判断是否部署于国外。设为1会启用qq音乐的jsonp返回，同时需要替换[前端插件](https://github.com/xizeyoupan/MetingJS)，能实现国内访问国外api服务解析qq音乐。部署在国内不用设置这个选项。当部署到vercel上时，此选项自动设为1。
- PORT
  api监听端口，也是docker需要映射的端口。默认3000
- METING_COOKIE_<SERVER>
  可选的平台 Cookie，例如 `METING_COOKIE_NETEASE`、`METING_COOKIE_TENCENT`。环境变量优先于 `cookie/<server>` 文件；仅通过有效签名的 `url`、`pic`、`lrc` 请求，且 Referer 主机命中 `METING_COOKIE_ALLOW_HOSTS` 白名单时，才会转发 Cookie。Referer 可伪造，不是身份认证。
- METING_COOKIE_ALLOW_HOSTS
  可选，逗号分隔的 Referer 主机白名单，例如 `music.example.com,player.example.org`。未配置或请求无有效 Referer 时不转发 Cookie。Referer 可由客户端伪造，仅作额外限制，不能代替鉴权。
- METING_TOKEN
  必填，API HMAC-SHA1 签名密钥，至少 32 字节；不设置或长度不足时 `/api` 返回 503。请使用安全随机值配置在部署环境中，不要提交到仓库或写入日志。歌词、播放链接、图片请求必须携带签名；`search`、`song`、`album`、`artist`、`playlist` 元数据请求保持公开兼容。签名 URL 是可重放的 bearer 链接，请全程使用 HTTPS，避免公开转发含签名的资源 URL。
- YT_API / SPOTIFY_API
  Spotify 与 YouTube Music 继续通过外部 API 服务转发；`YT_API` 可同时作为两者默认地址，也可单独指定 `SPOTIFY_API`。迁入 `@meting/core` 不会替换这些自定义 provider。
- UID
  用于docker，默认1010
- GID
  用于docker，默认1010

## 部署

部署 Meting-API 需要基本的计算机编程常识，如果您在部署过程中遇到无法解决的问题请到 issues 向我们提问，我们会尽快给您答复。

如果部署成功，在你的域名后拼接上`/test`，理论上出现类似下图数据：

![](assets/test.png)

### 手动部署

需要克隆项目到本地，node版本>=18。

```
npm i
```

#### Node

`node node.js`

<details>

<summary>Deprecated</summary>

#### Deno

`deno run --allow-net --allow-env dist/deno.js`

或者直接下载action中的文件运行。

</details>

### Docker 部署（海外服务器）

海外部署请从当前项目源码构建镜像，避免拉取未包含本项目最新功能的旧镜像。下面示例使用 Linux 服务器、Docker CLI、域名 `music.example.com` 和容器端口 `3000`；请替换为自己的域名与仓库地址。

#### 1. 配置域名和防火墙

将域名的 DNS A 记录指向海外服务器公网 IP，并在云服务商安全组/防火墙开放 **80、443** 端口供 HTTPS 反向代理使用。应用容器只绑定本机回环地址，不直接暴露 3000 端口。

镜像发布规则：合并到 `main` 会运行单元测试与镜像验收，不会自动推送镜像；推送 `v*` 版本标签会在验收通过后自动发布 Docker Hub 的多架构镜像；也可以在 GitHub Actions 手动运行 `Publish`，勾选 `docker` 后发布。真实音乐平台集成测试会受平台限流、地区策略和资源权限影响，默认不阻断发布；需要时可在手动运行 `Publish` 时勾选 `live_provider_tests` 单独执行。

#### 2. 获取源码并构建镜像

```bash
git clone https://github.com/maochenyu-me/Meting-API.git
cd Meting-API
docker build -t meting-api:local .
```

如果代码已在服务器上，进入项目目录后执行 `docker build -t meting-api:local .` 即可。

#### 3. 安全配置运行参数

`OVERSEAS=1` 会启用海外部署所需的 QQ 音乐 JSONP 路径；前端播放器需要使用本项目说明的 `@xizeyoupan/meting` 插件。`METING_TOKEN` 是必填签名密钥，至少 32 字节；下面使用 OpenSSL 生成 32 随机字节（64 个十六进制字符），并把配置文件放在源码目录之外、限制为仅 root 可读：

```bash
sudo install -d -m 700 /etc/meting-api
sudo sh -c 'umask 077; printf "%s\n" "OVERSEAS=1" "PORT=3000" "METING_TOKEN=$(openssl rand -hex 32)" > /etc/meting-api/production.env'
sudo chmod 600 /etc/meting-api/production.env
```

如需启用平台 Cookie，用 `sudoedit /etc/meting-api/production.env` 添加所需配置，例如：

```dotenv
METING_COOKIE_ALLOW_HOSTS=player.example.com
METING_COOKIE_NETEASE=在此填写网易云Cookie
METING_COOKIE_TENCENT=在此填写QQ音乐Cookie
```

仅填写实际需要的平台 Cookie。白名单填播放器网页的主机名（不含协议、端口或路径）；只有资源请求签名有效且 Referer 主机命中白名单时，服务才会转发 Cookie。不要把包含密钥或 Cookie 的配置文件放进项目目录、镜像或版本库。

Docker Hub 发布需要在 GitHub 仓库的 **Settings → Secrets and variables → Actions → New repository secret** 中添加 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN`。不要把这两个值加到服务器运行用的 `production.env`；它们仅用于 GitHub Actions 登录并推送镜像。

#### 4. 启动容器

```bash
docker run -d \\
  --name meting-api \\
  --restart unless-stopped \\
  --env-file /etc/meting-api/production.env \\
  -p 127.0.0.1:3000:3000 \\
  meting-api:local
```

#### 5. 配置 HTTPS 反向代理并验证

为 `music.example.com` 申请 TLS 证书（例如使用 Let's Encrypt），然后配置 Nginx 反代到容器的本机端口。将下方配置保存为 `/etc/nginx/sites-available/meting-api`，并把 `music.example.com` 替换成自己的域名：

```nginx
server {
    listen 80;
    server_name music.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name music.example.com;

    ssl_certificate /etc/letsencrypt/live/music.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/music.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $scheme://$host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置并确认 Nginx 校验通过后重载服务：

```bash
sudo ln -s /etc/nginx/sites-available/meting-api /etc/nginx/sites-enabled/meting-api
sudo nginx -t && sudo systemctl reload nginx
```

确认 DNS 和证书已生效后访问：

```bash
curl -fsS https://music.example.com/test
```

也可以查看容器运行状态与日志：

```bash
docker ps --filter name=meting-api
docker logs --tail 50 meting-api
```

API 的歌词、播放链接和图片资源 URL 带有可重放签名，应全程使用 HTTPS，避免公开转发这些资源链接。修改源码后重新执行镜像构建，并用相同的 `/etc/meting-api/production.env` 重建容器；保留原 `METING_TOKEN` 可避免已生成的签名 URL 因密钥改变而立即失效。

### 部署到vercel

比较出名，提供的域名被阻断，使用自有域名后速度尚可。冷启动速度一般。

<a href="https://vercel.com/import/project?template=https://github.com/xizeyoupan/Meting-API"><img src="https://vercel.com/button" height="36"></a>

一直下一步即可。

<details>

<summary>Deprecated</summary>

### Deno Deploy

类似Cloudflare Workers，但提供的域名未被阻断，使用Deno为runtime。

fork本项目后新建一个[project](https://dash.deno.com/projects)，首先在设置中加一个Environment Variable，名称是OVERSEAS，值为1。接着link到你自己的项目，部署方式选action，Deno Deploy 的 project 的 name 需要与你自己的yml中设置的吻合。

```yml
        uses: denoland/deployctl@v1
        with:
          project: meting #这里要改成你的Deno Deploy的project的name
          entrypoint: deno.js
```

接着在actions/publish/run workflow中勾选Deno即可。

</details>

## 杂项

### 反向代理

使用用nginx，让请求 `http://localhost:8099/meting` 的流量全部转发到 `http://localhost:3000` ，不能这么写：

```
   server {
      listen       8099;
      server_name  localhost;

      location /meting/ {
         proxy_pass http://localhost:3000/;
      }
   }
```

正确写法：

- nginx

   ```
   server {
      listen       8099;
      server_name  localhost;

      location /meting/ {
         proxy_pass http://localhost:3000/;
         proxy_set_header X-Forwarded-Host $scheme://$host:$server_port/meting;
      }
   }
   ```

- caddy
  
  ```
   http://localhost:8099 {
         handle_path /meting* {
                  reverse_proxy http://localhost:3000 {
                        header_up X-Forwarded-Host {scheme}://{host}:{port}/meting
                  }
         }
   }
  ```

### SSL证书

在上面基础上改动即可。

- nginx
  ```
      server {
        listen       8099 ssl;
        server_name  localhost;

        ssl_certificate     ../server.crt;  # pem文件的路径
        ssl_certificate_key  ../server.key; # key文件的路径
        ssl_session_timeout 5m;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers on;

        location /meting/ {
            proxy_pass http://localhost:3000/;
            proxy_set_header X-Forwarded-Host $scheme://$host:$server_port/meting;
        }
      }
  ```

- caddy
  ```
   https://localhost:8099 {
      tls ./server.crt ./server.key
      handle_path /meting* {
         reverse_proxy http://localhost:3000 {
            header_up X-Forwarded-Host {scheme}://{host}:{port}/meting
         }
      }
   }
  ```

## 使用

在导入[前端插件](https://github.com/xizeyoupan/MetingJS)前，加入

```
<script>
var meting_api='http://example.com/api?server=:server&type=:type&id=:id&auth=:auth&r=:r';
</script>
```

`METING_TOKEN` 启用后，请保留模板参数 `auth=:auth`。API 返回的歌词、播放链接和图片地址会自动带上签名，`@xizeyoupan/meting` 按模板参数请求这些资源时，服务端会校验其签名。

比如

```
<script>
var meting_api='http://localhost:3000/api?server=:server&type=:type&id=:id&auth=:auth&r=:r';
</script>
```

即可。就这样吧，那我去看vtb了，88

### 相关项目

https://github.com/metowolf/MetingJS

https://github.com/metowolf/Meting-API

https://github.com/honojs/hono

https://github.com/honojs/node-server

https://github.com/camsong/fetch-jsonp

https://github.com/Binaryify/NeteaseCloudMusicApi

https://github.com/jsososo/QQMusicApi
