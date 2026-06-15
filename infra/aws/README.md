# AWS image storage (Railway-compatible)

This Terraform stack provisions AWS resources for inventory photo storage while your app continues to run on Railway:

- Private S3 bucket (encrypted, versioned)
- CloudFront distribution for public image URLs
- IAM user + access key for Railway `api_service` uploads and AI analysis reads

Railway stays responsible for compute, Postgres, and deploys. AWS only stores and serves images.

## Prerequisites

1. [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
2. AWS account with permission to create S3, CloudFront, and IAM resources
3. AWS credentials configured locally, for example:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

Or use an AWS CLI profile:

```bash
export AWS_PROFILE=your-profile
```

## Deploy

From the repo root:

```bash
task infra:init
cp infra/aws/terraform.tfvars.example infra/aws/terraform.tfvars
# edit terraform.tfvars if needed
task infra:plan
task infra:apply
```

Or run Terraform directly:

```bash
cd infra/aws
terraform init
terraform plan
terraform apply
```

## Wire Railway

After apply, print the values to copy into **Railway -> api_service -> Variables**:

```bash
task infra:outputs
```

Set these variables on the `api_service` (not the frontend):

| Variable | Source |
|---|---|
| `AWS_REGION` | Terraform output |
| `AWS_ACCESS_KEY_ID` | Terraform output |
| `AWS_SECRET_ACCESS_KEY` | Terraform output (sensitive) |
| `S3_BUCKET_NAME` | Terraform output |
| `S3_KEY_PREFIX` | Terraform output (default `images`) |
| `S3_PUBLIC_BASE_URL` | Terraform output (`https://....cloudfront.net`) |
| `S3_ACL` | leave empty |

Redeploy `api_service` on Railway after setting variables.

## How it fits together

```text
Browser -> Railway api_service -> S3 PutObject
Browser <- CloudFront <- S3 GetObject (public image display)
Railway analysis worker -> S3 GetObject (AI reads photo bytes)
```

Uploaded objects are stored at:

```text
s3://<bucket>/images/<owner_uuid>/<random>.jpg
```

The API stores CloudFront URLs in Postgres, so the frontend can render images without extra config.

## Notes

- Terraform state is stored locally by default. For team use, configure a remote backend (S3 + DynamoDB lock table).
- Access keys live in Terraform state. Treat state as secret and rotate keys if it is ever exposed.
- CloudFront can take 5–15 minutes to finish deploying on first apply.
- To destroy: `task infra:destroy` (this deletes the bucket and images).
