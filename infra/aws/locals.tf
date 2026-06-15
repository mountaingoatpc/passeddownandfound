locals {
  name_prefix = "${var.project_name}-${var.environment}"

  bucket_name = var.bucket_name != "" ? var.bucket_name : "${local.name_prefix}-images-${random_id.bucket_suffix.hex}"

  iam_user_name = var.iam_user_name != "" ? var.iam_user_name : "${local.name_prefix}-railway-s3"

  image_object_arn = "${aws_s3_bucket.images.arn}/${var.s3_key_prefix}/*"
}
