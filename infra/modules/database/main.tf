# PostgreSQL as container on EC2 with EBS volume

variable "name" {
  description = "Name prefix for resources"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_id" {
  description = "Private subnet ID"
  type        = string
}

variable "volume_size" {
  description = "EBS volume size in GB"
  type        = number
  default     = 20
}

resource "aws_ebs_volume" "postgres" {
  availability_zone = data.aws_subnet.selected.availability_zone
  size              = var.volume_size
  type              = "gp3"

  tags = {
    Name = "${var.name}-postgres-volume"
  }
}

data "aws_subnet" "selected" {
  id = var.private_subnet_id
}

# Note: The actual PostgreSQL container runs on the EC2 instance
# This module provisions:
# 1. EBS volume for data persistence
# 2. Backup script to run nightly

resource "aws_cloudwatch_event_rule" "nightly_backup" {
  name                = "${var.name}-postgres-backup"
  schedule_expression = "cron(0 2 * * ? *)" # 2 AM UTC daily
}

resource "aws_cloudwatch_event_target" "backup_target" {
  rule      = aws_cloudwatch_event_rule.nightly_backup.name
  target_id = "backup"
  arn       = aws_lambda_function.backup.arn
}

resource "aws_lambda_function" "backup" {
  filename         = "${path.module}/backup_lambda.zip"
  function_name    = "${var.name}-postgres-backup"
  role             = aws_iam_role.backup.arn
  handler          = "index.handler"
  runtime          = "python3.11"
  timeout          = 300
}

resource "aws_iam_role" "backup" {
  name = "${var.name}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "backup" {
  name = "${var.name}-backup-policy"
  role = aws_iam_role.backup.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "logs:*"
        ]
        Resource = "*"
      }
    ]
  })
}

output "ebs_volume_id" {
  value = aws_ebs_volume.postgres.id
}