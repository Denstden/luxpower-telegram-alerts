#!/bin/bash

set -e

REMOTE_USER=${REMOTE_USER:-denst}
REMOTE_HOST=${REMOTE_HOST:-192.168.88.234}
REMOTE_DIR=${REMOTE_DIR:-/home/denst/luxpower-alerts}
DOCKER_USER=${DOCKER_USER:-denst}

if [ -z "$REMOTE_USER" ] || [ -z "$REMOTE_HOST" ]; then
  echo "Error: REMOTE_USER and REMOTE_HOST must be set"
  echo "Usage: REMOTE_USER=denst REMOTE_HOST=192.168.88.234 ./scripts/deploy.sh"
  exit 1
fi

echo "Deploying to $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR"
echo ""

echo "1. Creating remote directory..."
ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_DIR"

echo "2. Copying docker-compose.yml..."
scp docker-compose.yml "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

if [ -f ".env" ]; then
  echo "3. Copying .env file..."
  scp .env "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
else
  echo "3. ⚠️  Warning: .env file not found. You'll need to create it on the remote host."
fi

if [ -f "subscribers.json" ]; then
  echo "4. Copying subscribers.json..."
  scp subscribers.json "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
else
  echo "4. Creating empty subscribers.json on remote host..."
  ssh "$REMOTE_USER@$REMOTE_HOST" "touch $REMOTE_DIR/subscribers.json && chmod 666 $REMOTE_DIR/subscribers.json"
fi

if [ -f "status.json" ]; then
  echo "5. Copying status.json..."
  scp status.json "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
else
  echo "5. Creating empty status.json on remote host..."
  ssh "$REMOTE_USER@$REMOTE_HOST" "touch $REMOTE_DIR/status.json && chmod 666 $REMOTE_DIR/status.json"
fi

if [ -f "user-preferences.json" ]; then
  echo "6. Copying user-preferences.json..."
  scp user-preferences.json "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
else
  echo "6. Creating empty user-preferences.json on remote host..."
  ssh "$REMOTE_USER@$REMOTE_HOST" "touch $REMOTE_DIR/user-preferences.json && chmod 666 $REMOTE_DIR/user-preferences.json"
fi

echo ""
echo "✅ Files copied successfully!"
echo ""
echo "Next steps on remote host:"
echo "  ssh $REMOTE_USER@$REMOTE_HOST"
echo "  cd $REMOTE_DIR"
echo "  export DOCKER_USER=$DOCKER_USER"
echo "  docker-compose pull"
echo "  docker-compose up -d"
echo ""
echo "Or run remotely:"
echo "  ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_DIR && export DOCKER_USER=$DOCKER_USER && docker-compose pull && docker-compose up -d'"

