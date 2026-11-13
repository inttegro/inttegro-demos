FROM golang:1.27-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/inttegro-demo .

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/inttegro-demo ./inttegro-demo
COPY static ./static
COPY templates ./templates
EXPOSE 3003
ENTRYPOINT ["./inttegro-demo"]
