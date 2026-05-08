#!/bin/bash
# Start ApkZio API with Android SDK environment variables

# Set Android SDK environment variables
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Load other environment variables from .env
set -a
source .env
set +a

# Start the server
npm run dev
