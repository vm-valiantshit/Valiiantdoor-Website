#!/bin/bash

# Website File Transfer Utility
# This script downloads website files from a given URL
# Usage: ./download-from-url.sh <URL> [destination]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if URL is provided
if [ -z "$1" ]; then
    print_error "No URL provided"
    echo "Usage: $0 <URL> [destination]"
    echo ""
    echo "Examples:"
    echo "  $0 https://example.com/backup.zip"
    echo "  $0 https://example.com/backup.zip ./restore"
    exit 1
fi

URL="$1"
DEST="${2:-.}"

print_info "Starting file transfer from URL..."
print_info "Source: $URL"
print_info "Destination: $DEST"

# Create destination directory if it doesn't exist
mkdir -p "$DEST"

# Get filename from URL
FILENAME=$(basename "$URL")

# Download the file
print_info "Downloading $FILENAME..."

if command -v curl &> /dev/null; then
    curl -L -o "$DEST/$FILENAME" "$URL" || {
        print_error "Failed to download file"
        exit 1
    }
elif command -v wget &> /dev/null; then
    wget -O "$DEST/$FILENAME" "$URL" || {
        print_error "Failed to download file"
        exit 1
    }
else
    print_error "Neither curl nor wget is available. Please install one of them."
    exit 1
fi

print_info "Downloaded $FILENAME successfully"

# Check if it's an archive and extract it
if [[ "$FILENAME" =~ \.(zip|tar\.gz|tgz|tar)$ ]]; then
    print_info "Detected archive file. Extracting..."
    
    case "$FILENAME" in
        *.zip)
            if command -v unzip &> /dev/null; then
                unzip -o "$DEST/$FILENAME" -d "$DEST"
                print_info "Extracted ZIP archive"
            else
                print_warning "unzip command not found. Archive not extracted."
            fi
            ;;
        *.tar.gz|*.tgz)
            tar -xzf "$DEST/$FILENAME" -C "$DEST"
            print_info "Extracted TAR.GZ archive"
            ;;
        *.tar)
            tar -xf "$DEST/$FILENAME" -C "$DEST"
            print_info "Extracted TAR archive"
            ;;
    esac
    
    # Ask if user wants to keep the archive
    echo ""
    read -p "Keep the downloaded archive? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        rm "$DEST/$FILENAME"
        print_info "Removed archive file"
    fi
fi

print_info "Transfer complete!"
print_info "Files are available in: $DEST"

# List downloaded files
echo ""
print_info "Contents:"
ls -lh "$DEST"
