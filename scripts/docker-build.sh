#!/bin/bash

set -e

IMAGE_NAME=${1:-luxpower-telegram-alerts}
VERSION=${2:-$(jq -r '.version' package.json 2>/dev/null || echo 'latest')}
DOCKER_USER=${DOCKER_USER:-denst}

if [ -z "$DOCKER_USER" ]; then
  echo "Error: DOCKER_USER environment variable is not set"
  echo "Usage: DOCKER_USER=yourusername ./scripts/docker-build.sh [image-name] [version]"
  exit 1
fi

FULL_IMAGE_NAME="$DOCKER_USER/$IMAGE_NAME:$VERSION"

echo "Building Docker image: $FULL_IMAGE_NAME"

docker build -t "$FULL_IMAGE_NAME" .

docker tag "$FULL_IMAGE_NAME" "$DOCKER_USER/$IMAGE_NAME:latest"

echo ""
echo "Image built successfully!"
echo "Tags: $FULL_IMAGE_NAME, $DOCKER_USER/$IMAGE_NAME:latest"
echo ""
echo "To push to Docker Hub, run:"
echo "  docker push $FULL_IMAGE_NAME"
echo "  docker push $DOCKER_USER/$IMAGE_NAME:latest"

