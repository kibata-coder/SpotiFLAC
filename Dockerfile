# Build Stage
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Install dependencies required by SpotiFLAC
RUN apk add --no-cache git gcc musl-dev ffmpeg

# Cache Go modules
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the HTTP server binary
RUN go build -o server server.go

# Runtime Stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies (FFmpeg is critical for audio processing)
RUN apk add --no-cache ffmpeg ca-certificates

# Copy the compiled binary from the builder stage
COPY --from=builder /app/server .

# Expose the web port
EXPOSE 8080

# Start the server
CMD ["./server"]
