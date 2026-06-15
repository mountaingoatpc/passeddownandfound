variable "project_name" {
  description = "Short project name used in resource names."
  type        = string
  default     = "atticory"
}

variable "environment" {
  description = "Environment label (for example prod or staging)."
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for the image bucket and CloudFront origin."
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Optional globally-unique S3 bucket name. Leave empty to auto-generate one."
  type        = string
  default     = ""
}

variable "s3_key_prefix" {
  description = "Prefix for uploaded image keys. Must match S3_KEY_PREFIX in Railway."
  type        = string
  default     = "images"
}

variable "cloudfront_price_class" {
  description = "CloudFront price class for image delivery."
  type        = string
  default     = "PriceClass_100"
}

variable "iam_user_name" {
  description = "IAM user name Railway will use for S3 uploads and reads."
  type        = string
  default     = ""
}
