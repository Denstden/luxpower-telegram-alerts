#!/bin/bash

set -e

IMAGE_NAME=${1:-luxpower-telegram-alerts}
VERSION=${2:-latest}
DOCKER_USER=${DOCKER_USER:-denst}

if [ -z "$DOCKER_USER" ]; then
  echo "Error: DOCKER_USER environment variable is not set"
  echo "Usage: DOCKER_USER=yourusername ./scripts/docker-push.sh [image-name] [version]"
  exit 1
fi

FULL_IMAGE_NAME="$DOCKER_USER/$IMAGE_NAME:$VERSION"

echo "Pushing Docker image to Docker Hub: $FULL_IMAGE_NAME"
echo ""
echo "Note: Make sure you're logged in to Docker Hub:"
echo "  docker login"
echo ""

docker push "$FULL_IMAGE_NAME"

if [ "$VERSION" = "latest" ]; then
  echo "Pushed: $FULL_IMAGE_NAME"
else
  echo "Pushed: $FULL_IMAGE_NAME"
  echo ""
  echo "To also push as latest, run:"
  echo "  docker tag $FULL_IMAGE_NAME $DOCKER_USER/$IMAGE_NAME:latest"
  echo "  docker push $DOCKER_USER/$IMAGE_NAME:latest"
fi

echo ""
echo "Done! Image is now available on Docker Hub."

