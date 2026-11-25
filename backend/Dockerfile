# multi-stage: base (build)
# Node 22+ — better-auth ships ESM-only and the compiled CJS backend
# require()s it; require(ESM) is unsupported on the previous node:18.13
# base (ERR_REQUIRE_ESM at boot). 22.x is an active LTS line where
# require(ESM) works without flags.
FROM node:22 AS base

# create directory where the application will be built
WORKDIR /app

# copy over the dependency manifests, both the package.json 
# and the package-lock.json are copied over
COPY package*.json ./

# installs packages and their dependencies
RUN npm install

# copy over the prisma schema
COPY prisma/schema.prisma ./prisma/

# generate the prisma client based on the schema
RUN npm run prisma:generate

# copy over the code base
COPY . .

# create the bundle of the application
RUN npm run build

# multi-stage: production (runtime)
# Same major as the base stage so native modules copied via node_modules
# match the runtime ABI (both were built for the same Node version).
FROM node:22-slim AS production

# create arguments of builds time variables
ARG user=amplication
ARG group=${user}
ARG uid=1001
ARG gid=$uid

# [temporary] work around to be able to run prisma
RUN apt-get update -y && apt-get install -y openssl

# create directory where the application will be executed from
WORKDIR /app

# add the user and group
RUN groupadd --gid ${gid} ${user}
RUN useradd --uid ${uid} --gid ${gid} -m ${user}

# copy over the bundled code from the build stage
COPY --from=base /app/node_modules/ ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/scripts ./scripts
COPY --from=base /app/src ./src
COPY --from=base /app/tsconfig* ./
COPY --from=base /app/entrypoint.sh ./entrypoint.sh

# change ownership of the workspace directory
RUN chown -R ${uid}:${gid} /app/

# get rid of the development dependencies but keep prisma CLI for db push
RUN npm install --production && npm install prisma@^5.4.2 --no-save

# set user to the created non-privileged user
USER ${user}

# expose a specific port on the docker container
ENV PORT=3000
EXPOSE ${PORT}

# start the server using the entrypoint (syncs DB schema first)
CMD [ "sh", "./entrypoint.sh" ]
