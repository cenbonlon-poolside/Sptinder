# ECR repositories for api and web images

variable "name" {
  description = "Name prefix for resources"
  type        = string
}

resource "aws_ecr_repository" "api" {
  name = "${var.name}-api"
}

resource "aws_ecr_repository" "web" {
  name = "${var.name}-web"
}

output "api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "web_repository_url" {
  value = aws_ecr_repository.web.repository_url
}