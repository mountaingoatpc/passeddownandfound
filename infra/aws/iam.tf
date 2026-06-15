resource "aws_iam_user" "railway_api" {
  name = local.iam_user_name
}

resource "aws_iam_user_policy" "railway_api_images" {
  name = "${local.name_prefix}-s3-images"
  user = aws_iam_user.railway_api.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "WriteAndReadImages"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
        ]
        Resource = local.image_object_arn
      },
      {
        Sid    = "ListImagePrefix"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
        ]
        Resource = aws_s3_bucket.images.arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["${var.s3_key_prefix}/*"]
          }
        }
      }
    ]
  })
}

resource "aws_iam_access_key" "railway_api" {
  user = aws_iam_user.railway_api.name
}
