#!/bin/bash

# Healthcare API Route Testing Script
# Make sure server is running: npm run dev

BASE_URL="http://localhost:5001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Healthcare API Route Testing ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL" > /dev/null; then
  echo -e "${RED}❌ Server is not running. Please start it with: npm run dev${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}\n"

# Function to test endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local token=$3
  local data=$4
  local description=$5
  
  echo -e "${YELLOW}Testing: $description${NC}"
  echo "  $method $endpoint"
  
  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "  ${GREEN}✅ Success (HTTP $http_code)${NC}"
    echo "$body" | jq -r '.message // .' 2>/dev/null || echo "$body" | head -c 100
  else
    echo -e "  ${RED}❌ Failed (HTTP $http_code)${NC}"
    echo "$body" | jq -r '.message // .' 2>/dev/null || echo "$body" | head -c 100
  fi
  echo ""
}

# Step 1: Register test users (if they don't exist)
echo -e "${YELLOW}Step 1: Creating test users...${NC}\n"

register_user() {
  local name=$1
  local email=$2
  local password=$3
  local role=$4
  
  response=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$password\",\"role\":\"$role\"}")
  
  if echo "$response" | grep -q "successfully\|already exists"; then
    echo -e "  ${GREEN}✅ $role user ready: $email${NC}"
  else
    echo -e "  ${YELLOW}⚠️  $role user: $email (may already exist)${NC}"
  fi
}

register_user "Admin User" "admin@test.com" "admin123" "admin"
register_user "Dr. Smith" "doctor@test.com" "doctor123" "doctor"
register_user "John Patient" "patient@test.com" "patient123" "patient"
register_user "Nurse Jane" "nurse@test.com" "nurse123" "nurse"
register_user "Caregiver Bob" "caregiver@test.com" "caregiver123" "caregiver"

echo ""

# Step 2: Login and get tokens
echo -e "${YELLOW}Step 2: Logging in...${NC}\n"

login() {
  local email=$1
  local password=$2
  local role=$3
  
  response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}")
  
  token=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  
  if [ -n "$token" ]; then
    echo -e "  ${GREEN}✅ $role token obtained${NC}"
    echo "$token"
  else
    echo -e "  ${RED}❌ Failed to login as $role${NC}"
    echo ""
  fi
}

ADMIN_TOKEN=$(login "admin@test.com" "admin123" "Admin")
DOCTOR_TOKEN=$(login "doctor@test.com" "doctor123" "Doctor")
PATIENT_TOKEN=$(login "patient@test.com" "patient123" "Patient")
NURSE_TOKEN=$(login "nurse@test.com" "nurse123" "Nurse")
CAREGIVER_TOKEN=$(login "caregiver@test.com" "caregiver123" "Caregiver")

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Could not get tokens. Please check your database setup.${NC}"
  exit 1
fi

echo ""

# Step 3: Test endpoints
echo -e "${YELLOW}Step 3: Testing endpoints...${NC}\n"

# Doctor Routes
echo -e "${YELLOW}--- Doctor Routes ---${NC}"
test_endpoint "GET" "/api/doctors" "$PATIENT_TOKEN" "" "List all doctors"
test_endpoint "GET" "/api/doctors?specialization=Cardiology" "$PATIENT_TOKEN" "" "List doctors by specialization"

# Ward Routes
echo -e "${YELLOW}--- Ward Routes ---${NC}"
test_endpoint "GET" "/api/wards" "$ADMIN_TOKEN" "" "List all wards"
test_endpoint "POST" "/api/wards" "$ADMIN_TOKEN" '{"name":"Test Ward"}' "Create ward"

# Patient Routes
echo -e "${YELLOW}--- Patient Routes ---${NC}"
test_endpoint "GET" "/api/patients" "$ADMIN_TOKEN" "" "List all patients"
test_endpoint "GET" "/api/patients/my-profile/details" "$PATIENT_TOKEN" "" "Get my profile"

# Appointment Routes
echo -e "${YELLOW}--- Appointment Routes ---${NC}"
test_endpoint "GET" "/api/appointments" "$DOCTOR_TOKEN" "" "List appointments"
test_endpoint "GET" "/api/appointments/my-appointments/list" "$PATIENT_TOKEN" "" "Get my appointments"

# Nurse Routes
echo -e "${YELLOW}--- Nurse Routes ---${NC}"
test_endpoint "GET" "/api/nurses" "$ADMIN_TOKEN" "" "List all nurses"

# Admin Routes
echo -e "${YELLOW}--- Admin Routes ---${NC}"
test_endpoint "GET" "/api/admin/users" "$ADMIN_TOKEN" "" "List all users"
test_endpoint "GET" "/api/admin/audit-logs?limit=10" "$ADMIN_TOKEN" "" "Get audit logs"

# Caregiver Routes
echo -e "${YELLOW}--- Caregiver Routes ---${NC}"
test_endpoint "GET" "/api/caregivers/my-patients" "$CAREGIVER_TOKEN" "" "Get my patients"

echo -e "${GREEN}=== Testing Complete ===${NC}"
echo ""
echo "Note: Some endpoints may fail if test data is not fully set up."
echo "Make sure to:"
echo "  1. Create doctor records for doctors"
echo "  2. Create patient records for patients"
echo "  3. Assign doctors/nurses to wards"
echo ""
echo "See TESTING_GUIDE.md for detailed instructions."
