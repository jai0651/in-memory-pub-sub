#!/bin/bash

# Plivo Pub/Sub System Startup Script
# This script starts the Pub/Sub server with proper environment configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) detected"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    print_success "npm $(npm --version) detected"
}

# Install dependencies if needed
install_dependencies() {
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
        print_success "Dependencies installed successfully"
    else
        print_status "Dependencies already installed"
    fi
}

# Create logs directory if it doesn't exist
create_logs_dir() {
    if [ ! -d "logs" ]; then
        print_status "Creating logs directory..."
        mkdir -p logs
        print_success "Logs directory created"
    fi
}

# Set environment variables
set_environment() {
    # Default values
    export NODE_ENV=${NODE_ENV:-production}
    export PORT=${PORT:-3000}
    export HOST=${HOST:-0.0.0.0}
    export LOG_LEVEL=${LOG_LEVEL:-info}
    
    # Pub/Sub specific settings
    export MAX_MESSAGES_PER_TOPIC=${MAX_MESSAGES_PER_TOPIC:-100}
    export MAX_QUEUE_SIZE=${MAX_QUEUE_SIZE:-1000}
    export BACKPRESSURE_POLICY=${BACKPRESSURE_POLICY:-drop_oldest}
    export HEARTBEAT_INTERVAL=${HEARTBEAT_INTERVAL:-30000}
    
    print_status "Environment configured:"
    print_status "  NODE_ENV: $NODE_ENV"
    print_status "  PORT: $PORT"
    print_status "  HOST: $HOST"
    print_status "  LOG_LEVEL: $LOG_LEVEL"
    print_status "  MAX_MESSAGES_PER_TOPIC: $MAX_MESSAGES_PER_TOPIC"
    print_status "  MAX_QUEUE_SIZE: $MAX_QUEUE_SIZE"
    print_status "  BACKPRESSURE_POLICY: $BACKPRESSURE_POLICY"
    print_status "  HEARTBEAT_INTERVAL: ${HEARTBEAT_INTERVAL}ms"
}

# Start the server
start_server() {
    print_status "Starting Pub/Sub server..."
    print_status "Server will be available at:"
    print_status "  HTTP: http://$HOST:$PORT"
    print_status "  WebSocket: ws://$HOST:$PORT/ws"
    print_status "  Health: http://$HOST:$PORT/health"
    print_status "  Topics: http://$HOST:$PORT/topics"
    print_status "  Stats: http://$HOST:$PORT/stats"
    echo ""
    
    # Start the server
    exec node server.js
}

# Main execution
main() {
    echo "🚀 Plivo Pub/Sub System Startup"
    echo "=================================="
    echo ""
    
    # Check prerequisites
    check_node
    check_npm
    
    # Setup environment
    install_dependencies
    create_logs_dir
    set_environment
    
    echo ""
    print_success "All checks passed. Starting server..."
    echo ""
    
    # Start the server
    start_server
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --dev          Start in development mode"
        echo "  --debug        Enable debug logging"
        echo ""
        echo "Environment Variables:"
        echo "  PORT                           Server port (default: 3000)"
        echo "  HOST                           Server host (default: 0.0.0.0)"
        echo "  LOG_LEVEL                      Logging level (default: info)"
        echo "  MAX_MESSAGES_PER_TOPIC         Max messages per topic (default: 100)"
        echo "  MAX_QUEUE_SIZE                 Max WebSocket buffer (default: 1000)"
        echo "  BACKPRESSURE_POLICY            Policy: drop_oldest|disconnect (default: drop_oldest)"
        echo "  HEARTBEAT_INTERVAL             Heartbeat interval in ms (default: 30000)"
        echo ""
        echo "Examples:"
        echo "  $0                              # Start with defaults"
        echo "  $0 --dev                        # Start in development mode"
        echo "  PORT=8080 $0                    # Start on port 8080"
        echo "  LOG_LEVEL=debug $0              # Start with debug logging"
        exit 0
        ;;
    --dev)
        export NODE_ENV=development
        export LOG_LEVEL=debug
        print_warning "Starting in development mode with debug logging"
        ;;
    --debug)
        export LOG_LEVEL=debug
        print_warning "Debug logging enabled"
        ;;
esac

# Run main function
main "$@"
