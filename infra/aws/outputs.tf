output "s3_bucket_name" {
  description = "S3 bucket used for inventory images."
  value       = aws_s3_bucket.images.id
}

output "aws_region" {
  description = "AWS region where the bucket lives."
  value       = var.aws_region
}

output "s3_key_prefix" {
  description = "Object key prefix for uploaded images."
  value       = var.s3_key_prefix
}

output "cloudfront_domain_name" {
  description = "CloudFront domain serving public image URLs."
  value       = aws_cloudfront_distribution.images.domain_name
}

output "s3_public_base_url" {
  description = "Set S3_PUBLIC_BASE_URL in Railway to this value."
  value       = "https://${aws_cloudfront_distribution.images.domain_name}"
}

output "iam_user_name" {
  description = "IAM user Railway uses for S3 access."
  value       = aws_iam_user.railway_api.name
}

output "aws_access_key_id" {
  description = "AWS access key for Railway api_service."
  value       = aws_iam_access_key.railway_api.id
}

output "aws_secret_access_key" {
  description = "AWS secret key for Railway api_service."
  value       = aws_iam_access_key.railway_api.secret
  sensitive   = true
}

output "railway_api_service_variables" {
  description = "Copy these into Railway -> api_service -> Variables."
  value = {
    AWS_REGION            = var.aws_region
    AWS_ACCESS_KEY_ID     = aws_iam_access_key.railway_api.id
    AWS_SECRET_ACCESS_KEY = aws_iam_access_key.railway_api.secret
    S3_BUCKET_NAME        = aws_s3_bucket.images.id
    S3_KEY_PREFIX         = var.s3_key_prefix
    S3_PUBLIC_BASE_URL    = "https://${aws_cloudfront_distribution.images.domain_name}"
    S3_ACL                = ""
  }
  sensitive = true
}
