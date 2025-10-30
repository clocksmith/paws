#!/bin/bash
# reploid/tests/run-all-tests.sh
# Comprehensive test runner for MCP-based Reploid

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Test directories
BASE_DIR="/home/clocksmith/deco/paws/reploid"
TEST_DIR="$BASE_DIR/tests"

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   MCP-BASED REPLOID TEST SUITE             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Function to run a test file
run_test() {
  local test_file=$1
  local test_name=$2

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  echo -e "${YELLOW}[TEST ${TOTAL_TESTS}]${NC} Running: ${test_name}"
  echo -e "  File: ${test_file}"

  if [ ! -f "$test_file" ]; then
    echo -e "  ${RED}✗ SKIP${NC}: Test file not found"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    echo ""
    return
  fi

  # Check if test is blocked (contains "BLOCKED" in first 50 lines)
  if head -50 "$test_file" | grep -q "BLOCKED:"; then
    local blocker=$(head -50 "$test_file" | grep "BLOCKED:" | head -1)
    echo -e "  ${YELLOW}⏳ SKIP${NC}: ${blocker}"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    echo ""
    return
  fi

  # Run the test
  if node "$test_file" > /tmp/test-output.txt 2>&1; then
    echo -e "  ${GREEN}✓ PASS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "  ${RED}✗ FAIL${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo ""
    echo -e "  ${RED}Error output:${NC}"
    cat /tmp/test-output.txt | head -20
  fi

  echo ""
}

# Parse command line arguments
VERBOSE=false
BENCHMARK=false
E2E_ONLY=false
UNIT_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -b|--benchmark)
      BENCHMARK=true
      shift
      ;;
    -e|--e2e-only)
      E2E_ONLY=true
      shift
      ;;
    -u|--unit-only)
      UNIT_ONLY=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -v, --verbose      Show verbose output"
      echo "  -b, --benchmark    Run performance benchmarks"
      echo "  -e, --e2e-only     Run only end-to-end tests"
      echo "  -u, --unit-only    Run only unit tests"
      echo "  -h, --help         Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}Configuration:${NC}"
echo "  Base directory: $BASE_DIR"
echo "  Test directory: $TEST_DIR"
echo "  Verbose: $VERBOSE"
echo "  Benchmark: $BENCHMARK"
echo ""

# Phase 1: Unit Tests (MCP Server Tests)
if [ "$E2E_ONLY" = false ]; then
  echo -e "${BLUE}════════════════════════════════════════════${NC}"
  echo -e "${BLUE}PHASE 1: MCP SERVER UNIT TESTS${NC}"
  echo -e "${BLUE}════════════════════════════════════════════${NC}"
  echo ""

  run_test "$TEST_DIR/mcp-servers/vfs-server.test.js" "VFS MCP Server"
  run_test "$TEST_DIR/mcp-servers/workflow-server.test.js" "Workflow MCP Server"

  # Add more server tests as they're created
  # run_test "$TEST_DIR/mcp-servers/analytics-server.test.js" "Analytics MCP Server"
fi

# Phase 2: Widget Tests
if [ "$E2E_ONLY" = false ] && [ "$UNIT_ONLY" = false ]; then
  echo -e "${BLUE}════════════════════════════════════════════${NC}"
  echo -e "${BLUE}PHASE 2: LENS WIDGET TESTS${NC}"
  echo -e "${BLUE}════════════════════════════════════════════${NC}"
  echo ""

  # Widget tests would typically run in browser, so we skip them here
  # Users can run them manually via browser
  echo -e "${YELLOW}⏳ SKIP${NC}: Widget tests must be run in browser"
  echo "  Open: http://localhost:8080/lens/widgets/reploid/tests/"
  echo ""
  SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
fi

# Phase 3: Integration Tests
if [ "$UNIT_ONLY" = false ]; then
  echo -e "${BLUE}════════════════════════════════════════════${NC}"
  echo -e "${BLUE}PHASE 3: INTEGRATION TESTS${NC}"
  echo -e "${BLUE}════════════════════════════════════════════${NC}"
  echo ""

  # Add integration tests here as they're created
  # run_test "$TEST_DIR/integration/mcp-bridge.test.js" "MCP Bridge Integration"

  echo -e "${YELLOW}⏳ INFO${NC}: No integration tests defined yet"
  echo ""
fi

# Phase 4: End-to-End Tests
if [ "$UNIT_ONLY" = false ]; then
  echo -e "${BLUE}════════════════════════════════════════════${NC}"
  echo -e "${BLUE}PHASE 4: END-TO-END TESTS${NC}"
  echo -e "${BLUE}════════════════════════════════════════════${NC}"
  echo ""

  run_test "$TEST_DIR/e2e/approval-workflow.test.js" "Full Approval Workflow"

  # Add more E2E tests as they're created
  # run_test "$TEST_DIR/e2e/multi-agent.test.js" "Multi-Agent Workflow"
fi

# Phase 5: Performance Benchmarks (optional)
if [ "$BENCHMARK" = true ]; then
  echo -e "${BLUE}════════════════════════════════════════════${NC}"
  echo -e "${BLUE}PHASE 5: PERFORMANCE BENCHMARKS${NC}"
  echo -e "${BLUE}════════════════════════════════════════════${NC}"
  echo ""

  run_test "$TEST_DIR/benchmarks/mcp-overhead.bench.js" "MCP Protocol Overhead"

  # Add more benchmarks as they're created
  # run_test "$TEST_DIR/benchmarks/widget-performance.bench.js" "Widget Performance"
fi

# Summary
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""
echo "  Total tests:   $TOTAL_TESTS"
echo -e "  ${GREEN}Passed:${NC}        $PASSED_TESTS"
echo -e "  ${RED}Failed:${NC}        $FAILED_TESTS"
echo -e "  ${YELLOW}Skipped:${NC}       $SKIPPED_TESTS"
echo ""

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
  SUCCESS_RATE=$(( (PASSED_TESTS * 100) / (TOTAL_TESTS - SKIPPED_TESTS) ))
  echo "  Success rate:  ${SUCCESS_RATE}%"
  echo ""
fi

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
  if [ $SKIPPED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${YELLOW}⚠ All tests were skipped (dependencies not ready)${NC}"
    exit 2
  else
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
  fi
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
