# Production image. Build from the SDK root (both repos in the context):
#   docker build -f oxid-fe-user/Dockerfile -t oxid-fe-user .
# Run with API_UPSTREAM pointing at the shop, e.g.:
#   docker run -e API_UPSTREAM=http://apache -p 8080:80 oxid-fe-user

FROM node:22-alpine AS builder
WORKDIR /build
COPY oxid-fe-core/ oxid-fe-core/
RUN cd oxid-fe-core && npm ci && npm run build
COPY oxid-fe-user/ oxid-fe-user/
RUN cd oxid-fe-user && npm ci && npm run build

FROM nginx:1.27-alpine
COPY --from=builder /build/oxid-fe-user/dist /usr/share/nginx/html
COPY oxid-fe-user/nginx/default.conf.template /etc/nginx/templates/default.conf.template
ENV API_UPSTREAM=http://localhost.local
