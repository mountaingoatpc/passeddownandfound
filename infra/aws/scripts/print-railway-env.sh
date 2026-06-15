#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is not installed" >&2
  exit 1
fi

if [[ ! -d .terraform ]]; then
  echo "Run 'task infra:init' first." >&2
  exit 1
fi

echo "# Copy into Railway -> api_service -> Variables"
echo
echo "AWS_REGION=$(terraform output -raw aws_region)"
echo "AWS_ACCESS_KEY_ID=$(terraform output -raw aws_access_key_id)"
echo "AWS_SECRET_ACCESS_KEY=***redacted***"
echo "S3_BUCKET_NAME=$(terraform output -raw s3_bucket_name)"
echo "S3_KEY_PREFIX=$(terraform output -raw s3_key_prefix)"
echo "S3_PUBLIC_BASE_URL=$(terraform output -raw s3_public_base_url)"
echo "S3_ACL="
echo
echo "# Secret value (paste into Railway):"
echo -n "AWS_SECRET_ACCESS_KEY="
terraform output -raw aws_secret_access_key
echo
